"""Seed script for QueueLess Bharat development, testing, and India demo coverage (M6.1).

Populates:
1. Platform test identities:
   - Admin: admin@queless.gov.in / AdminPass123!
   - Operator: operator@queless.gov.in / OperatorPass123!
   - Citizen: citizen@queless.gov.in / CitizenPass123!
2. Baseline test facility (Bhopal AIIMS Central Hospital)
3. Verified representative facilities across 8 major Indian cities:
   - Pune (Showcase city)
   - Mumbai
   - Bengaluru
   - Chennai
   - Kolkata
   - Delhi
   - Lucknow
   - Patna
4. Realistic civic services, counters, and deterministic simulated queue scenarios:
   - Short queue
   - Moderate queue
   - Long queue
   - Different active counter configurations
   - Insufficient-data / unavailable scenarios
   - Closed / halted counter scenario

IMPORTANT PROVENANCE RULE:
All seeded queue values are DEMO / SIMULATED DATA.
Never present seeded values as live, real-time, or actual queue measurements.
"""

import asyncio
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Ensure backend root directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.domain.enums import (
    CounterStatus,
    LocationCategory,
    LocationStatus,
    ObservationSource,
    QueueEventType,
    QueueSessionStatus,
    ServiceStatus,
    UserRole,
)
from app.domain.models import (
    Counter,
    Location,
    QueueEvent,
    QueueSession,
    Service,
    ServiceSession,
    User,
    WaitObservation,
)

# Canonical dataset specifications for verified Indian civic institutions (M6.1)
FACILITY_SPECS = [
    # --- PUNE (Showcase City) ---
    {
        "city": "Pune",
        "state": "Maharashtra",
        "name": "Pune Regional Transport Office (MH-12 RTO)",
        "category": LocationCategory.RTO,
        "address": "38, Dr. Ambedkar Road, Near Sangam Bridge, Pune, Maharashtra 411001",
        "latitude": 18.5293,
        "longitude": 73.8640,
        "services": [
            {
                "name": "Driving Licence Renewal",
                "description": (
                    "Permanent driving licence renewal, biometric re-verification, "
                    "and address endorsement"
                ),
                "counters": [
                    {"name": "Counter 1 - Renewal Verification", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2 - Biometrics & Photo", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 8,
                    "durations": [180, 210, 240, 195, 225, 210, 180, 240, 200, 230, 215, 220],
                },
            },
            {
                "name": "Learner Licence Test & Biometrics",
                "description": "Computerized regulatory knowledge exam and learner token issuance",
                "counters": [
                    {"name": "Desk A - Document Verification", "status": CounterStatus.ACTIVE},
                    {"name": "Desk B - Test Terminal Window", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "short",
                    "waiting_count": 2,
                    "durations": [120, 135, 140, 125, 130, 145, 130, 120, 135, 140],
                },
            },
            {
                "name": "Vehicle Registration & Transfer",
                "description": (
                    "New vehicle registration clearance and ownership transfer NOC window"
                ),
                "counters": [
                    {"name": "Window 1 - Registration Intake", "status": CounterStatus.ACTIVE},
                    {
                        "name": "Window 2 - NOC & Inspection Clearance",
                        "status": CounterStatus.ACTIVE,
                    },
                ],
                "scenario": {
                    "type": "long",
                    "waiting_count": 26,
                    "durations": [
                        280,
                        310,
                        330,
                        300,
                        290,
                        320,
                        340,
                        310,
                        295,
                        315,
                        305,
                        325,
                        310,
                        300,
                    ],
                },
            },
        ],
    },
    {
        "city": "Pune",
        "state": "Maharashtra",
        "name": "Sassoon General Hospital",
        "category": LocationCategory.HOSPITAL,
        "address": "Near Pune Railway Station, Jai Prakash Narayan Road, Pune, Maharashtra 411001",
        "latitude": 18.5262,
        "longitude": 73.8710,
        "services": [
            {
                "name": "OPD General Medicine Registration",
                "description": "Central triage registration and physician consultation token",
                "counters": [
                    {"name": "Counter 1 - Senior Citizens & Women", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2 - General OPD", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 3 - General OPD", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 12,
                    "durations": [
                        160,
                        180,
                        200,
                        175,
                        190,
                        180,
                        170,
                        195,
                        185,
                        175,
                        190,
                        180,
                        170,
                        185,
                        190,
                    ],
                },
            },
            {
                "name": "Radiology & Ultrasound Token",
                "description": (
                    "Diagnostic ultrasonography and digital X-ray investigation scheduling"
                ),
                "counters": [
                    {"name": "Window 1 - Imaging Desk", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    # Scenario: Insufficient data (zero completed throughput sessions)
                    "type": "insufficient_data",
                    "waiting_count": 4,
                    "durations": [],
                },
            },
        ],
    },
    {
        "city": "Pune",
        "state": "Maharashtra",
        "name": "Pune Municipal Corporation (PMC Main Building)",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "Shivajinagar, Pune, Maharashtra 411005",
        "latitude": 18.5289,
        "longitude": 73.8523,
        "services": [
            {
                "name": "Property Tax Assessment & Payment",
                "description": (
                    "Annual civic property tax self-assessment clearance and payment receipt window"
                ),
                "counters": [
                    {"name": "Counter 1 - Billing Clearance", "status": CounterStatus.ACTIVE},
                    {
                        "name": "Counter 2 - Digital Payment Collection",
                        "status": CounterStatus.ACTIVE,
                    },
                ],
                "scenario": {
                    "type": "short",
                    "waiting_count": 1,
                    "durations": [140, 150, 160, 145, 155, 150, 140, 160],
                },
            },
            {
                "name": "Birth & Death Certificate Counter",
                "description": (
                    "Vital statistics official certification and civic record extract window"
                ),
                "counters": [
                    {"name": "Window 1 - Certification Desk", "status": CounterStatus.MAINTENANCE},
                ],
                "scenario": {
                    # Scenario: Halted queue (zero active counters)
                    "type": "halted_no_counter",
                    "waiting_count": 5,
                    "durations": [180, 200, 190],
                },
            },
        ],
    },
    # --- MUMBAI ---
    {
        "city": "Mumbai",
        "state": "Maharashtra",
        "name": "Mumbai Central RTO (MH-01 Tardeo)",
        "category": LocationCategory.RTO,
        "address": "Tardeo Road, Tulsiwadi, Tardeo, Mumbai, Maharashtra 400034",
        "latitude": 18.9715,
        "longitude": 72.8164,
        "services": [
            {
                "name": "Permanent Driving Licence Track",
                "description": "Practical test verification and smart-card licence issuance",
                "counters": [
                    {"name": "Counter 1 - Application Intake", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2 - Biometrics Capture", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 10,
                    "durations": [210, 240, 220, 230, 250, 215, 225, 240, 230, 220],
                },
            },
        ],
    },
    {
        "city": "Mumbai",
        "state": "Maharashtra",
        "name": "KEM Hospital Mumbai",
        "category": LocationCategory.HOSPITAL,
        "address": "Acharya Donde Marg, Parel, Mumbai, Maharashtra 400012",
        "latitude": 19.0028,
        "longitude": 72.8427,
        "services": [
            {
                "name": "OPD Specialty Consultation",
                "description": "Specialized tertiary care consultation queue token",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 3", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "long",
                    "waiting_count": 30,
                    "durations": [
                        180,
                        200,
                        190,
                        210,
                        195,
                        205,
                        190,
                        185,
                        200,
                        195,
                        210,
                        190,
                        200,
                        195,
                        205,
                    ],
                },
            },
        ],
    },
    {
        "city": "Mumbai",
        "state": "Maharashtra",
        "name": "BMC Civic Centre (Brihanmumbai Municipal Corporation)",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "Mahapalika Marg, Dhobi Talao, Fort, Mumbai, Maharashtra 400001",
        "latitude": 18.9416,
        "longitude": 72.8339,
        "services": [
            {
                "name": "Water & Property Tax Desk",
                "description": "Municipal billing assessment and property grievance resolution",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "short",
                    "waiting_count": 3,
                    "durations": [150, 160, 140, 155, 165, 150, 145, 155],
                },
            },
        ],
    },
    # --- BENGALURU ---
    {
        "city": "Bengaluru",
        "state": "Karnataka",
        "name": "Bengaluru Central RTO (KA-01 Koramangala)",
        "category": LocationCategory.RTO,
        "address": "BDA Shopping Complex, Koramangala, Bengaluru, Karnataka 560034",
        "latitude": 12.9345,
        "longitude": 77.6226,
        "services": [
            {
                "name": "Driving Licence Smart Card Issuance",
                "description": "Smart-card driving licence printing and dispatch counter",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 9,
                    "durations": [180, 210, 200, 190, 220, 205, 195, 215, 200, 210],
                },
            },
        ],
    },
    {
        "city": "Bengaluru",
        "state": "Karnataka",
        "name": "Victoria Hospital Bengaluru",
        "category": LocationCategory.HOSPITAL,
        "address": "Fort Road, Near City Market, Bengaluru, Karnataka 560002",
        "latitude": 12.9625,
        "longitude": 77.5753,
        "services": [
            {
                "name": "Outpatient Registration Desk",
                "description": "Primary healthcare registration and token dispensing",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 14,
                    "durations": [150, 170, 160, 180, 165, 175, 160, 155, 170, 165, 180, 160],
                },
            },
        ],
    },
    {
        "city": "Bengaluru",
        "state": "Karnataka",
        "name": "BBMP Citizen Service Centre",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "NR Square, Bengaluru, Karnataka 560002",
        "latitude": 12.9675,
        "longitude": 77.5880,
        "services": [
            {
                "name": "Khata Certificate & Property Desk",
                "description": "A-Khata certification, mutation, and revenue extract window",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "insufficient_data",
                    "waiting_count": 3,
                    "durations": [],
                },
            },
        ],
    },
    # --- CHENNAI ---
    {
        "city": "Chennai",
        "state": "Tamil Nadu",
        "name": "Chennai Central RTO (TN-01 Ayanavaram)",
        "category": LocationCategory.RTO,
        "address": "No. 1, Pilkington Road, Ayanavaram, Chennai, Tamil Nadu 600023",
        "latitude": 13.0977,
        "longitude": 80.2366,
        "services": [
            {
                "name": "Licence Endorsement & Renewal",
                "description": "Badge endorsement and commercial transport permit renewal",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "short",
                    "waiting_count": 2,
                    "durations": [130, 140, 150, 135, 145, 140, 130, 150],
                },
            },
        ],
    },
    {
        "city": "Chennai",
        "state": "Tamil Nadu",
        "name": "Rajiv Gandhi Government General Hospital",
        "category": LocationCategory.HOSPITAL,
        "address": "EVR Periyar Salai, Park Town, Chennai, Tamil Nadu 600003",
        "latitude": 13.0805,
        "longitude": 80.2785,
        "services": [
            {
                "name": "General Medicine OPD Token",
                "description": "Outpatient clinic token and medical screening desk",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "long",
                    "waiting_count": 22,
                    "durations": [170, 190, 180, 200, 185, 195, 180, 175, 190, 185, 200, 180],
                },
            },
        ],
    },
    {
        "city": "Chennai",
        "state": "Tamil Nadu",
        "name": "Greater Chennai Corporation (Ripon Building)",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "Raja Muthiah Salai, Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003",
        "latitude": 13.0827,
        "longitude": 80.2755,
        "services": [
            {
                "name": "Revenue & Trade Licence Counter",
                "description": "Commercial establishment licence renewal and civic fees window",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 6,
                    "durations": [180, 200, 190, 210, 195, 205, 190, 200],
                },
            },
        ],
    },
    # --- KOLKATA ---
    {
        "city": "Kolkata",
        "state": "West Bengal",
        "name": "Beltala Public Vehicles Department (RTO Kolkata)",
        "category": LocationCategory.RTO,
        "address": "38, Beltala Road, Bhowanipore, Kolkata, West Bengal 700020",
        "latitude": 22.5276,
        "longitude": 88.3512,
        "services": [
            {
                "name": "Driving Licence & Fitness Certificate",
                "description": "Commercial vehicle fitness token and driving licence counter",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 11,
                    "durations": [200, 220, 210, 230, 215, 225, 210, 220, 215],
                },
            },
        ],
    },
    {
        "city": "Kolkata",
        "state": "West Bengal",
        "name": "SSKM Hospital Kolkata",
        "category": LocationCategory.HOSPITAL,
        "address": "244, AJC Bose Road, Bhowanipore, Kolkata, West Bengal 700020",
        "latitude": 22.5392,
        "longitude": 88.3444,
        "services": [
            {
                "name": "OPD Cardiology & Medicine",
                "description": "Super-specialty cardiology consultation and investigation token",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 3", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "long",
                    "waiting_count": 28,
                    "durations": [
                        180,
                        200,
                        190,
                        210,
                        195,
                        205,
                        190,
                        185,
                        200,
                        195,
                        210,
                        190,
                        200,
                        195,
                    ],
                },
            },
        ],
    },
    {
        "city": "Kolkata",
        "state": "West Bengal",
        "name": "Kolkata Municipal Corporation",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "5, S.N. Banerjee Road, Kolkata, West Bengal 700013",
        "latitude": 22.5606,
        "longitude": 88.3534,
        "services": [
            {
                "name": "Assessment & Collection Counter",
                "description": "Municipal rates, taxes, and mutation record collection",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "short",
                    "waiting_count": 2,
                    "durations": [140, 150, 160, 145, 155, 150],
                },
            },
        ],
    },
    # --- DELHI ---
    {
        "city": "Delhi",
        "state": "Delhi",
        "name": "Delhi Transport Department (Mall Road RTO)",
        "category": LocationCategory.RTO,
        "address": "5/9 Under Hill Road, Civil Lines, Delhi 110054",
        "latitude": 28.6756,
        "longitude": 77.2224,
        "services": [
            {
                "name": "International Driving Permit & Licence",
                "description": "IDP verification and digitized transport registration desk",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 7,
                    "durations": [180, 200, 190, 210, 195, 205, 190, 185, 200, 195],
                },
            },
        ],
    },
    {
        "city": "Delhi",
        "state": "Delhi",
        "name": "AIIMS New Delhi",
        "category": LocationCategory.HOSPITAL,
        "address": "Sri Aurobindo Marg, Ansari Nagar East, New Delhi, Delhi 110029",
        "latitude": 28.5672,
        "longitude": 77.2100,
        "services": [
            {
                "name": "Rajkumari Amrit Kaur OPD Desk",
                "description": "Central OPD registration and physician triage token desk",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 3", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 4", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "long",
                    "waiting_count": 35,
                    "durations": [
                        160,
                        180,
                        170,
                        190,
                        175,
                        185,
                        170,
                        165,
                        180,
                        175,
                        190,
                        170,
                        180,
                        175,
                        185,
                        170,
                    ],
                },
            },
        ],
    },
    {
        "city": "Delhi",
        "state": "Delhi",
        "name": "MCD Civic Centre Delhi",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "JLN Marg, Minto Road, New Delhi, Delhi 110002",
        "latitude": 28.6385,
        "longitude": 77.2285,
        "services": [
            {
                "name": "Citizen Services & Property Tax",
                "description": (
                    "Civic grievance reporting, property tax clearance, and mutation services"
                ),
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 8,
                    "durations": [170, 190, 180, 200, 185, 195, 180, 175, 190],
                },
            },
        ],
    },
    # --- LUCKNOW ---
    {
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        "name": "Lucknow Transport Office (UP-32 RTO Transport Nagar)",
        "category": LocationCategory.RTO,
        "address": "Transport Nagar, Kanpur Road, Lucknow, Uttar Pradesh 226012",
        "latitude": 26.7820,
        "longitude": 80.8872,
        "services": [
            {
                "name": "Commercial Vehicle & Licence Desk",
                "description": "Commercial badge licensing and vehicle tax clearance desk",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 8,
                    "durations": [190, 210, 200, 220, 205, 215, 200, 210],
                },
            },
        ],
    },
    {
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        "name": "KGMU Hospital Lucknow",
        "category": LocationCategory.HOSPITAL,
        "address": "Shah Mina Road, Chowk, Lucknow, Uttar Pradesh 226003",
        "latitude": 26.8693,
        "longitude": 80.9168,
        "services": [
            {
                "name": "Shatabdi OPD Registration",
                "description": (
                    "Outpatient department registration and specialist consultation token"
                ),
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "long",
                    "waiting_count": 25,
                    "durations": [180, 200, 190, 210, 195, 205, 190, 185, 200, 195],
                },
            },
        ],
    },
    {
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        "name": "Lucknow Municipal Corporation (Nagar Nigam)",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "Triloki Nath Road, Lalbagh, Lucknow, Uttar Pradesh 226001",
        "latitude": 26.8480,
        "longitude": 80.9425,
        "services": [
            {
                "name": "Public Grievance & Certificates",
                "description": "Municipal certificate issuance and grievance registration window",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "short",
                    "waiting_count": 2,
                    "durations": [140, 150, 160, 145, 155, 150, 140],
                },
            },
        ],
    },
    # --- PATNA ---
    {
        "city": "Patna",
        "state": "Bihar",
        "name": "Patna District Transport Office (BR-01 DTO)",
        "category": LocationCategory.RTO,
        "address": "Collectorate Compound, Gandhi Maidan, Patna, Bihar 800001",
        "latitude": 25.6175,
        "longitude": 85.1432,
        "services": [
            {
                "name": "Driving Licence Testing & Approval",
                "description": "Practical test certification and driving licence approval",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 10,
                    "durations": [200, 220, 210, 230, 215, 225, 210, 220],
                },
            },
        ],
    },
    {
        "city": "Patna",
        "state": "Bihar",
        "name": "Patna Medical College and Hospital (PMCH)",
        "category": LocationCategory.HOSPITAL,
        "address": "Ashok Rajpath, Patna, Bihar 800004",
        "latitude": 25.6207,
        "longitude": 85.1580,
        "services": [
            {
                "name": "Emergency & OPD Registration",
                "description": "Emergency triage and OPD consultation token issuance",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                    {"name": "Counter 2", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "moderate",
                    "waiting_count": 18,
                    "durations": [170, 190, 180, 200, 185, 195, 180, 175, 190, 185, 200],
                },
            },
        ],
    },
    {
        "city": "Patna",
        "state": "Bihar",
        "name": "Patna Municipal Corporation (PMC Head Office)",
        "category": LocationCategory.GOVERNMENT_OFFICE,
        "address": "Maurya Lok Complex, New Dak Bunglow Road, Patna, Bihar 800001",
        "latitude": 25.6095,
        "longitude": 85.1376,
        "services": [
            {
                "name": "Birth/Death Certificate & Civic Tax",
                "description": "Civil registration certificate and municipal trade tax clearance",
                "counters": [
                    {"name": "Counter 1", "status": CounterStatus.ACTIVE},
                ],
                "scenario": {
                    "type": "insufficient_data",
                    "waiting_count": 4,
                    "durations": [],
                },
            },
        ],
    },
]


async def seed_service_scenario(
    session: AsyncSession,
    service: Service,
    counter: Counter | None,
    scenario: dict,
    now: datetime,
) -> None:
    """Deterministically populates simulated queue sessions and historical throughput.

    All created sessions flow strictly through the pure deterministic queue engine.
    """
    # Check if sessions already seeded for this service
    existing_sessions = await session.execute(
        select(QueueSession.id).where(QueueSession.service_id == service.id).limit(1)
    )
    if existing_sessions.scalar_one_or_none():
        return

    durations: list[int] = scenario.get("durations", [])
    waiting_count: int = scenario.get("waiting_count", 0)

    # 1. Seed completed service sessions (empirical throughput baseline)
    for idx, d in enumerate(durations):
        # Anchor completed events in recent 45 minutes with fresh signals
        offset_seconds = (len(durations) - idx) * 120 + 300
        completed_time = now - timedelta(seconds=offset_seconds)
        started_time = completed_time - timedelta(seconds=d)
        checkin_time = started_time - timedelta(minutes=5)

        qs = QueueSession(
            service_id=service.id,
            user_id=f"simulated-completed-{idx + 1}@queless.demo",
            status=QueueSessionStatus.COMPLETED,
            checked_in_at=checkin_time,
            service_started_at=started_time,
            completed_at=completed_time,
        )
        session.add(qs)
        await session.flush()

        # Append lifecycle events
        session.add(
            QueueEvent(
                queue_session_id=qs.id,
                event_type=QueueEventType.CHECKED_IN,
                event_time=checkin_time,
                event_metadata={"mode": "simulated", "scenario": scenario.get("type", "demo")},
            )
        )
        session.add(
            QueueEvent(
                queue_session_id=qs.id,
                event_type=QueueEventType.SERVICE_STARTED,
                event_time=started_time,
                event_metadata={"mode": "simulated"},
            )
        )
        session.add(
            QueueEvent(
                queue_session_id=qs.id,
                event_type=QueueEventType.SERVICE_COMPLETED,
                event_time=completed_time,
                event_metadata={"mode": "simulated", "duration_seconds": d},
            )
        )

        # Service session providing duration observation to the estimator
        session.add(
            ServiceSession(
                queue_session_id=qs.id,
                service_id=service.id,
                counter_id=counter.id if counter else None,
                started_at=started_time,
                completed_at=completed_time,
                duration_seconds=d,
            )
        )

    # 2. Seed active waiting queue sessions (people waiting in line ahead)
    for i in range(waiting_count):
        # Stagger check-in times deterministically
        checkin_time = now - timedelta(seconds=(waiting_count - i) * 60 + 60)
        qs_waiting = QueueSession(
            service_id=service.id,
            user_id=f"Simulated Citizen Token #{i + 1}",
            status=QueueSessionStatus.WAITING,
            checked_in_at=checkin_time,
        )
        session.add(qs_waiting)
        await session.flush()

        session.add(
            QueueEvent(
                queue_session_id=qs_waiting.id,
                event_type=QueueEventType.CHECKED_IN,
                event_time=checkin_time,
                event_metadata={"mode": "simulated", "position": i + 1},
            )
        )

    # 3. Add point-in-time observation signal
    active_counters_count = 1 if counter and counter.status == CounterStatus.ACTIVE else 0
    session.add(
        WaitObservation(
            service_id=service.id,
            observed_at=now - timedelta(minutes=3),
            people_ahead=waiting_count,
            reported_wait_minutes=None,
            active_counters=active_counters_count,
            source=ObservationSource.SYSTEM,
        )
    )


async def seed() -> None:
    """Executes deterministic seed population."""
    async with async_session_factory() as session:
        now = datetime.now(UTC)

        # ---------------------------------------------------------
        # 1. Baseline Test Facility (Bhopal AIIMS Central Hospital)
        # ---------------------------------------------------------
        bhopal_stmt = select(Location).where(Location.name == "AIIMS Central Hospital")
        bhopal_loc = (await session.execute(bhopal_stmt)).scalar_one_or_none()
        if not bhopal_loc:
            bhopal_loc = Location(
                name="AIIMS Central Hospital",
                category=LocationCategory.HOSPITAL,
                address="Saket Nagar",
                city="Bhopal",
                state="Madhya Pradesh",
                timezone="Asia/Kolkata",
                latitude=23.2065,
                longitude=77.4542,
                status=LocationStatus.ACTIVE,
            )
            session.add(bhopal_loc)
            await session.flush()
            print(f"Created baseline location: {bhopal_loc.name} ({bhopal_loc.id})")

        bhopal_svc_stmt = select(Service).where(
            Service.location_id == bhopal_loc.id, Service.name == "OPD General Medicine"
        )
        bhopal_svc = (await session.execute(bhopal_svc_stmt)).scalar_one_or_none()
        if not bhopal_svc:
            bhopal_svc = Service(
                location_id=bhopal_loc.id,
                name="OPD General Medicine",
                description="General OPD consultation queue",
                status=ServiceStatus.ACTIVE,
            )
            session.add(bhopal_svc)
            await session.flush()
            print(f"Created baseline service: {bhopal_svc.name} ({bhopal_svc.id})")

        bhopal_cnt_stmt = select(Counter).where(
            Counter.service_id == bhopal_svc.id, Counter.name == "Counter 1"
        )
        bhopal_cnt = (await session.execute(bhopal_cnt_stmt)).scalar_one_or_none()
        if not bhopal_cnt:
            bhopal_cnt = Counter(
                service_id=bhopal_svc.id,
                name="Counter 1",
                status=CounterStatus.ACTIVE,
            )
            session.add(bhopal_cnt)
            await session.flush()
            print(f"Created baseline counter: {bhopal_cnt.name} ({bhopal_cnt.id})")

        # ---------------------------------------------------------
        # 2. Test Users
        # ---------------------------------------------------------
        admin_stmt = select(User).where(User.email == "admin@queless.gov.in")
        admin = (await session.execute(admin_stmt)).scalar_one_or_none()
        if not admin:
            admin = User(
                email="admin@queless.gov.in",
                hashed_password=get_password_hash("AdminPass123!"),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin)
            print("Created admin: admin@queless.gov.in")

        op_stmt = select(User).where(User.email == "operator@queless.gov.in")
        op = (await session.execute(op_stmt)).scalar_one_or_none()
        if not op:
            op = User(
                email="operator@queless.gov.in",
                hashed_password=get_password_hash("OperatorPass123!"),
                full_name="Desk Operator Rajesh",
                role=UserRole.OPERATOR,
                is_active=True,
                assigned_service_id=bhopal_svc.id,
            )
            session.add(op)
            print("Created operator: operator@queless.gov.in")

        cit_stmt = select(User).where(User.email == "citizen@queless.gov.in")
        cit = (await session.execute(cit_stmt)).scalar_one_or_none()
        if not cit:
            cit = User(
                email="citizen@queless.gov.in",
                hashed_password=get_password_hash("CitizenPass123!"),
                full_name="Citizen Amit Sharma",
                role=UserRole.CITIZEN,
                is_active=True,
            )
            session.add(cit)
            print("Created citizen: citizen@queless.gov.in")

        # ---------------------------------------------------------
        # 3. India Demo Facility Dataset (M6.1 — 8 Initial Cities)
        # ---------------------------------------------------------
        print("Populating India demo facilities across 8 cities...")
        for spec in FACILITY_SPECS:
            loc_stmt = select(Location).where(
                Location.city == spec["city"], Location.name == spec["name"]
            )
            loc = (await session.execute(loc_stmt)).scalar_one_or_none()
            if not loc:
                loc = Location(
                    name=spec["name"],
                    category=spec["category"],
                    address=spec["address"],
                    city=spec["city"],
                    state=spec["state"],
                    timezone="Asia/Kolkata",
                    latitude=spec["latitude"],
                    longitude=spec["longitude"],
                    status=LocationStatus.ACTIVE,
                )
                session.add(loc)
                await session.flush()
                print(f"  + Added Location: [{spec['city']}] {loc.name}")
            else:
                print(f"  . Location exists: [{spec['city']}] {loc.name}")

            for svc_spec in spec["services"]:
                svc_stmt = select(Service).where(
                    Service.location_id == loc.id, Service.name == svc_spec["name"]
                )
                svc = (await session.execute(svc_stmt)).scalar_one_or_none()
                if not svc:
                    svc = Service(
                        location_id=loc.id,
                        name=svc_spec["name"],
                        description=svc_spec["description"],
                        status=ServiceStatus.ACTIVE,
                    )
                    session.add(svc)
                    await session.flush()
                    print(f"    - Added Service: {svc.name}")

                first_counter: Counter | None = None
                for cnt_spec in svc_spec["counters"]:
                    cnt_stmt = select(Counter).where(
                        Counter.service_id == svc.id, Counter.name == cnt_spec["name"]
                    )
                    cnt = (await session.execute(cnt_stmt)).scalar_one_or_none()
                    if not cnt:
                        cnt = Counter(
                            service_id=svc.id,
                            name=cnt_spec["name"],
                            status=cnt_spec["status"],
                        )
                        session.add(cnt)
                        await session.flush()
                        print(f"      * Added Counter: {cnt.name} ({cnt.status})")
                    if first_counter is None:
                        first_counter = cnt

                # Populate deterministic queue simulation scenario
                scenario = svc_spec.get("scenario")
                if scenario:
                    await seed_service_scenario(
                        session=session,
                        service=svc,
                        counter=first_counter,
                        scenario=scenario,
                        now=now,
                    )

        await session.commit()
        print("\nDatabase seed completed successfully with verified India demo coverage.")


if __name__ == "__main__":
    asyncio.run(seed())
