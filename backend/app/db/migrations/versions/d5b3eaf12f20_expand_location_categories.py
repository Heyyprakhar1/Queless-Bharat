"""expand_location_categories

Revision ID: d5b3eaf12f20
Revises: c9e050c432db
Create Date: 2026-10-08 17:57:06.385440

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5b3eaf12f20"
down_revision: str | None = "c9e050c432db"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("chk_locations_category", "locations", type_="check")
    op.create_check_constraint(
        "chk_locations_category",
        "locations",
        "category IN ('hospital', 'government_office', 'rto', 'municipal_service_centre', 'university', 'college', 'diagnostic_centre', 'bank', 'restaurant', 'cafeteria', 'hotel', 'public_service_centre')",
    )


def downgrade() -> None:
    op.drop_constraint("chk_locations_category", "locations", type_="check")
    op.create_check_constraint(
        "chk_locations_category",
        "locations",
        "category IN ('hospital', 'rto', 'government_office')",
    )
