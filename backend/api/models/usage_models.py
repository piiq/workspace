"""Per-user resource usage."""

from uuid import UUID

from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import UUIDType

from api.models.model_helpers import Base, DateMixin, UUIDMixin


class UserUsage(Base, UUIDMixin, DateMixin):
    """Resource usage for users."""

    __tablename__ = "user_usage"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True, unique=True
    )
    user = relationship("User")

    number_copilot_calls_day_count = Column(Integer, nullable=False, default=0)
    total_file_upload_size_gb_count = Column(Float, nullable=False, default=0)
