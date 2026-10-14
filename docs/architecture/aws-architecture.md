# AWS Cloud Architecture & Infrastructure Topology

> **Status:** Architecture Design / Pre-Implementation Baseline
> **Target Cloud Platform:** Amazon Web Services (AWS)

---

## 1. High-Level Production Topology

The target production infrastructure topology for QueuelessBharat follows a multi-tier, security-isolated architecture orchestrated across multiple Availability Zones (AZs):

```
                   [ Internet ]
                        │
                        │ HTTPS (Port 443)
                        ▼
       ┌─────────────────────────────────┐
       │    Application Load Balancer    │  (Public Subnets)
       │    (AWS Certificate Manager)    │
       └────────────────┬────────────────┘
                        │ HTTP (Internal Health/Traffic)
                        ▼
       ┌─────────────────────────────────┐
       │   Elastic Beanstalk Instances   │  (Private Application Subnets)
       │   (Auto Scaling Group, Multi-AZ)│
       └────────────────┬────────────────┘
                        │ PostgreSQL Port 5432
                        ▼
       ┌─────────────────────────────────┐
       │       Amazon RDS PostgreSQL      │  (Private Database Subnets)
       │       (Multi-AZ, Encrypted)     │
       └─────────────────────────────────┘
```

---

## 2. Virtual Private Cloud (VPC) & Subnet Design

The network is segregated into three functional subnet tiers across at least two Availability Zones (e.g., `ap-south-1a`, `ap-south-1b`) for high availability:

1. **Public Subnets (Ingress Tier):**
   - Hosts internet-facing Application Load Balancers (ALBs).
   - Associated with an Internet Gateway (IGW) route table.
   - Strictly contains no compute application servers or database instances.

2. **Private Application Subnets (Compute Tier):**
   - Hosts AWS Elastic Beanstalk EC2 instances running the modular monolith application container/runtime.
   - Instances receive internal IP addresses only; no direct public IP allocation.
   - Ingress is strictly restricted to incoming requests forwarded by the ALB.

3. **Private Database Subnets (Data Tier):**
   - Hosts Amazon RDS PostgreSQL DB instances (Primary and Multi-AZ Standby).
   - **Explicit Isolation:** Has zero routes to the Internet Gateway.
   - RDS instances are explicitly configured with `PubliclyAccessible = false`.
   - Accessible strictly from within the private application tier.

---

## 3. Security Group Architecture & Least-Privilege Flow

Network isolation is enforced at the hypervisor level via granular Security Group rules:

| Security Group | Inbound Rules | Outbound Rules | Purpose |
| :--- | :--- | :--- | :--- |
| **`sg-alb`** (ALB) | `TCP 443` from `0.0.0.0/0`<br>`TCP 80` from `0.0.0.0/0` (redirects to 443) | `TCP [App Port]` to `sg-app` | Terminates client SSL/TLS and forwards valid requests. |
| **`sg-app`** (Application) | `TCP [App Port]` strictly from `sg-alb` | `TCP 5432` to `sg-db`<br>Outbound HTTPS for permitted dependencies | Executes application workloads; rejects direct internet ingress. |
| **`sg-db`** (Database) | `TCP 5432` strictly from `sg-app` | None (or internal NTP/DNS as required by AWS) | Prevents all access except from authenticated application instances. |

---

## 4. Egress & NAT Architecture Decision Framework

> **Important Architecture Policy:** NAT Gateway is **not** assumed to be mandatory from day one.

### Cost & Requirement Evaluation
An AWS Managed NAT Gateway incurs a fixed hourly charge plus data processing costs per Availability Zone. In early stages and hackathon/MVP environments, outbound internet access must be evaluated against actual runtime requirements:

1. **Self-Contained Mode:** If the application only communicates with RDS, CloudWatch, and AWS services, VPC Endpoints (AWS PrivateLink) or S3 Gateway Endpoints can provide private service access without a general NAT Gateway.
2. **External Integration Mode (AI APIs):** If the application requires external outbound calls (such as calling third-party LLM inference APIs over the internet), egress alternatives will be compared:
   - Evaluated options: Cost-managed single-AZ NAT Gateway vs. NAT instance vs. AWS PrivateLink integrations.
3. **Decision Rule:** NAT resources will be introduced via Infrastructure as Code (Terraform) only when outbound internet requirements are finalized, avoiding unnecessary cloud expenditure during bootstrap phases.

---

## 5. Identity & Access Management (IAM)

Security boundaries follow the principle of least privilege:

- **Elastic Beanstalk Instance Role:**
  EC2 instances assume an IAM role granting only essential permissions:
  - Write access to Amazon CloudWatch Logs for application and runtime logs.
  - Read-only access to specific application secrets stored in AWS Systems Manager Parameter Store or AWS Secrets Manager.
  - Zero broad administrative or cross-service permissions.
- **CI/CD Deployment Role via OpenID Connect (OIDC):**
  GitHub Actions connects to AWS using short-lived OpenID Connect (OIDC) federation tokens:
  - Eliminates the need to store long-lived AWS Access Keys (`AKIA...`) in repository secrets.
  - Assumes a dedicated role scoped strictly to deploying application artifacts to Elastic Beanstalk and updating infrastructure via Terraform.

---

## 6. Observability & Telemetry

- **Amazon CloudWatch Logs:** Centralized ingestion for application structured logs, audit trails, and web server access logs.
- **Amazon CloudWatch Metrics & Alarms:**
  - ALB request rates, HTTP 4xx/5xx counts, and target response latency.
  - EC2 instance CPU utilization and memory consumption.
  - RDS CPU utilization, freeable memory, connection count, and read/write IOPS.
- **Health Checks:** The ALB actively checks a dedicated `/health` endpoint exposed by the backend application to trigger automated instance replacement upon failure.
