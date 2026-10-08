"""Concurrency regression tests verifying row-level locking and race-free queue transitions."""

import asyncio
import uuid

import httpx
import pytest
from sqlalchemy import func, select

from app.db.session import async_session_factory
from app.domain.enums import QueueSessionStatus
from app.domain.models import Location, QueueSession, Service, ServiceSession


@pytest.fixture
async def setup_test_service(db_session, admin_auth):
    """Sets up a facility and service for concurrency tests."""
    location = Location(
        name="Concurrency General Hospital",
        category="hospital",
        address="123 MG Road",
        city="Pune",
        state="Maharashtra",
    )
    db_session.add(location)
    await db_session.flush()

    service = Service(
        location_id=location.id,
        name="Concurrency OPD",
        status="active",
    )
    db_session.add(service)
    await db_session.commit()
    await db_session.refresh(service)
    return service


class TestQueueConcurrency:
    """Verifies that pessimistic row locking eliminates state transition races
    under high concurrency.
    """

    async def test_concurrent_start_service_single_winner(
        self, unauth_client: httpx.AsyncClient, admin_auth, setup_test_service
    ):
        """Proves two concurrent start_service requests serialize: one wins, one receives 400."""
        _, _, admin_hdrs = admin_auth
        service = setup_test_service

        # 1. Check in a ticket
        checkin_resp = await unauth_client.post(
            "/api/v1/queue/check-in",
            json={"service_id": str(service.id)},
            headers=admin_hdrs,
        )
        assert checkin_resp.status_code == 201
        session_id = checkin_resp.json()["id"]

        # 2. Fire two concurrent start_service requests using asyncio.gather
        async def call_start():
            # Use separate httpx client request
            return await unauth_client.post(
                f"/api/v1/queue/{session_id}/start",
                headers=admin_hdrs,
            )

        resp1, resp2 = await asyncio.gather(call_start(), call_start(), return_exceptions=False)

        status_codes = sorted([resp1.status_code, resp2.status_code])
        # Exactly one succeeds (200), one fails (400 Bad Request due to InvalidStateTransitionError)
        assert status_codes == [200, 400]

        # Verify only one ServiceSession was created in the database
        async with async_session_factory() as session:
            count_stmt = (
                select(func.count())
                .select_from(ServiceSession)
                .where(ServiceSession.queue_session_id == uuid.UUID(session_id))
            )
            ss_count = (await session.execute(count_stmt)).scalar()
            assert ss_count == 1

            qs_stmt = select(QueueSession).where(QueueSession.id == uuid.UUID(session_id))
            qs = (await session.execute(qs_stmt)).scalar_one()
            assert qs.status == QueueSessionStatus.IN_SERVICE

    async def test_concurrent_start_and_cancel_race(
        self, unauth_client: httpx.AsyncClient, admin_auth, setup_test_service
    ):
        """Proves concurrent start vs cancel race resolves cleanly: one wins, other receives 400."""
        _, _, admin_hdrs = admin_auth
        service = setup_test_service

        checkin_resp = await unauth_client.post(
            "/api/v1/queue/check-in",
            json={"service_id": str(service.id)},
            headers=admin_hdrs,
        )
        assert checkin_resp.status_code == 201
        session_id = checkin_resp.json()["id"]

        async def call_start():
            return await unauth_client.post(
                f"/api/v1/queue/{session_id}/start",
                headers=admin_hdrs,
            )

        async def call_cancel():
            return await unauth_client.post(
                f"/api/v1/queue/{session_id}/cancel",
                json={"reason": "User changed mind"},
                headers=admin_hdrs,
            )

        resp1, resp2 = await asyncio.gather(call_start(), call_cancel(), return_exceptions=False)

        status_codes = sorted([resp1.status_code, resp2.status_code])
        assert status_codes == [200, 400]

        async with async_session_factory() as session:
            qs_stmt = select(QueueSession).where(QueueSession.id == uuid.UUID(session_id))
            qs = (await session.execute(qs_stmt)).scalar_one()
            assert qs.status in (QueueSessionStatus.IN_SERVICE, QueueSessionStatus.CANCELLED)

    async def test_concurrent_complete_service_single_winner(
        self, unauth_client: httpx.AsyncClient, admin_auth, setup_test_service
    ):
        """Proves two concurrent complete_service requests serialize: one wins, one receives 400."""
        _, _, admin_hdrs = admin_auth
        service = setup_test_service

        checkin_resp = await unauth_client.post(
            "/api/v1/queue/check-in",
            json={"service_id": str(service.id)},
            headers=admin_hdrs,
        )
        session_id = checkin_resp.json()["id"]

        # Advance to IN_SERVICE first
        start_resp = await unauth_client.post(
            f"/api/v1/queue/{session_id}/start",
            headers=admin_hdrs,
        )
        assert start_resp.status_code == 200

        # Fire two concurrent complete requests
        async def call_complete():
            return await unauth_client.post(
                f"/api/v1/queue/{session_id}/complete",
                headers=admin_hdrs,
            )

        resp1, resp2 = await asyncio.gather(
            call_complete(), call_complete(), return_exceptions=False
        )

        status_codes = sorted([resp1.status_code, resp2.status_code])
        assert status_codes == [200, 400]

        async with async_session_factory() as session:
            qs_stmt = select(QueueSession).where(QueueSession.id == uuid.UUID(session_id))
            qs = (await session.execute(qs_stmt)).scalar_one()
            assert qs.status == QueueSessionStatus.COMPLETED
