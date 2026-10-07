"""Seed script for QueueLess Bharat development and testing.

Populates default location, service, counter, and test users:
- Admin: admin@queless.gov.in / AdminPass123!
- Operator: operator@queless.gov.in / OperatorPass123!
- Citizen: citizen@queless.gov.in / CitizenPass123!
"""

import asyncio

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.domain.enums import (
    CounterStatus,
    LocationCategory,
    LocationStatus,
    ServiceStatus,
    UserRole,
)
from app.domain.models import Counter, Location, Service, User


async def seed() -> None:
    async with async_session_factory() as session:
        # 1. Location
        loc_stmt = select(Location).where(Location.name == "AIIMS Central Hospital")
        loc = (await session.execute(loc_stmt)).scalar_one_or_none()
        if not loc:
            loc = Location(
                name="AIIMS Central Hospital",
                category=LocationCategory.HOSPITAL,
                address="Saket Nagar",
                city="Bhopal",
                state="Madhya Pradesh",
                timezone="Asia/Kolkata",
                status=LocationStatus.ACTIVE,
            )
            session.add(loc)
            await session.flush()
            print(f"Created location: {loc.name} ({loc.id})")
        else:
            print(f"Location exists: {loc.name} ({loc.id})")

        # 2. Service
        svc_stmt = select(Service).where(
            Service.location_id == loc.id, Service.name == "OPD General Medicine"
        )
        svc = (await session.execute(svc_stmt)).scalar_one_or_none()
        if not svc:
            svc = Service(
                location_id=loc.id,
                name="OPD General Medicine",
                description="General OPD consultation queue",
                status=ServiceStatus.ACTIVE,
            )
            session.add(svc)
            await session.flush()
            print(f"Created service: {svc.name} ({svc.id})")
        else:
            print(f"Service exists: {svc.name} ({svc.id})")

        # 3. Counter
        cnt_stmt = select(Counter).where(Counter.service_id == svc.id, Counter.name == "Counter 1")
        cnt = (await session.execute(cnt_stmt)).scalar_one_or_none()
        if not cnt:
            cnt = Counter(
                service_id=svc.id,
                name="Counter 1",
                status=CounterStatus.ACTIVE,
            )
            session.add(cnt)
            await session.flush()
            print(f"Created counter: {cnt.name} ({cnt.id})")
        else:
            print(f"Counter exists: {cnt.name} ({cnt.id})")

        # 4. Admin User
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
        else:
            print("Admin user exists: admin@queless.gov.in")

        # 5. Operator User (assigned to OPD General Medicine)
        op_stmt = select(User).where(User.email == "operator@queless.gov.in")
        op = (await session.execute(op_stmt)).scalar_one_or_none()
        if not op:
            op = User(
                email="operator@queless.gov.in",
                hashed_password=get_password_hash("OperatorPass123!"),
                full_name="Desk Operator Rajesh",
                role=UserRole.OPERATOR,
                is_active=True,
                assigned_service_id=svc.id,
            )
            session.add(op)
            print("Created operator: operator@queless.gov.in")
        else:
            print("Operator user exists: operator@queless.gov.in")

        # 6. Citizen User
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
        else:
            print("Citizen user exists: citizen@queless.gov.in")

        await session.commit()
        print("Database seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
