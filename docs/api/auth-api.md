# Authentication & Identity API Reference

QueuelessBharat provides a secure, stateless authentication and identity boundary supporting Role-Based Access Control (RBAC) across three distinct roles: `CITIZEN`, `OPERATOR`, and `ADMIN`.

All endpoints are served under `/api/v1/auth`.

---

## 1. Register User

Creates a new platform user identity.

- **URL:** `POST /api/v1/auth/register`
- **Authentication:** None (Public)
- **Status Code:** `201 Created`

### Request Body
```json
{
  "email": "priya.patel@example.com",
  "password": "SecurePassword123!",
  "full_name": "Priya Patel",
  "role": "CITIZEN",
  "assigned_service_id": null
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` (Email) | Yes | Valid email address, unique across platform. |
| `password` | `string` | Yes | Minimum 8 characters. Hashed with salted bcrypt. |
| `full_name` | `string` | Yes | Human-readable user name (1-255 characters). |
| `role` | `string` | No | One of `CITIZEN` (default), `OPERATOR`, `ADMIN`. |
| `assigned_service_id` | `uuid` | No | Required for operators to bind authorization scope. |

### Response (`201 Created`)
```json
{
  "id": "e4f8a846-9b51-4089-9fc6-9e9c97b212f4",
  "email": "priya.patel@example.com",
  "full_name": "Priya Patel",
  "role": "CITIZEN",
  "is_active": true,
  "assigned_service_id": null,
  "created_at": "2026-10-07T14:30:00Z"
}
```

### Error Responses
- `409 Conflict`: Email address is already registered.
- `422 Unprocessable Entity`: Password too short or invalid email format.

---

## 2. Login (Issue Token)

Authenticates user credentials and returns a signed HMAC-SHA256 JWT access token.

- **URL:** `POST /api/v1/auth/login`
- **Authentication:** None (Public)
- **Status Code:** `200 OK`

### Request Body
```json
{
  "email": "priya.patel@example.com",
  "password": "SecurePassword123!"
}
```

### Response (`200 OK`)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "e4f8a846-9b51-4089-9fc6-9e9c97b212f4",
    "email": "priya.patel@example.com",
    "full_name": "Priya Patel",
    "role": "CITIZEN",
    "is_active": true,
    "assigned_service_id": null,
    "created_at": "2026-10-07T14:30:00Z"
  }
}
```

### Error Responses
- `401 Unauthorized`: Invalid email or password.
- `403 Forbidden`: Account is inactive/disabled.

---

## 3. Get Current User Profile

Retrieves the authenticated identity from the provided Bearer token.

- **URL:** `GET /api/v1/auth/me`
- **Authentication:** `Bearer <token>`
- **Status Code:** `200 OK`

### Headers
```http
Authorization: Bearer <access_token>
```

### Response (`200 OK`)
```json
{
  "id": "e4f8a846-9b51-4089-9fc6-9e9c97b212f4",
  "email": "priya.patel@example.com",
  "full_name": "Priya Patel",
  "role": "CITIZEN",
  "is_active": true,
  "assigned_service_id": null,
  "created_at": "2026-10-07T14:30:00Z"
}
```

### Error Responses
- `401 Unauthorized`: Missing, expired, or tampered JWT.

---

## 4. Logout

Notifies the server of session termination. The client clears the local token.

- **URL:** `POST /api/v1/auth/logout`
- **Authentication:** `Bearer <token>`
- **Status Code:** `200 OK`

### Response (`200 OK`)
```json
{
  "message": "Logged out successfully"
}
```

---

## Role & Permission Matrix

| Endpoint | Method | CITIZEN | OPERATOR | ADMIN | Unauthenticated |
|---|---|:---:|:---:|:---:|:---:|
| `/auth/register` | `POST` | Allowed | Allowed | Allowed | Allowed |
| `/auth/login` | `POST` | Allowed | Allowed | Allowed | Allowed |
| `/auth/me` | `GET` | Own | Own | Own | Rejected (401) |
| `/locations` | `POST` | Denied (403) | Denied (403) | Allowed | Denied (401) |
| `/services` | `POST` | Denied (403) | Denied (403) | Allowed | Denied (401) |
| `/counters` | `POST` | Denied (403) | Assigned (201) | Allowed (201) | Denied (401) |
| `/queue/check-in` | `POST` | Allowed (201) | Allowed (201) | Allowed (201) | Denied (401) |
| `/queue/{id}/status` | `GET` | Own ticket only | Assigned service | All tickets | Denied (401) |
| `/queue/{id}/cancel` | `POST` | Own ticket only | Denied (403) | All tickets | Denied (401) |
| `/queue/{id}/start` | `POST` | Denied (403) | Assigned service | All tickets | Denied (401) |
| `/queue/{id}/complete` | `POST` | Denied (403) | Assigned service | All tickets | Denied (401) |
| `/services/{id}/queue-status` | `GET` | Allowed | Allowed | Allowed | Allowed (Public) |
| `/services/{id}/observations` | `POST` | Allowed | Allowed | Allowed | Allowed (Public) |
