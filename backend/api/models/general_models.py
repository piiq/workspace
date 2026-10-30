"""General models"""

from sqlalchemy import Column, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.models.model_helpers import Base, DateMixin, UUIDMixin


class Log(Base, UUIDMixin, DateMixin):
    """Logs errors in our requests"""

    __tablename__ = "log"

    request = Column(Text(), default=None)
    error = Column(Text(), default=None)
    status_code = Column(Integer(), default=None)
    method = Column(Text(), default=None)

    def __str__(self) -> str:
        return f"{self.request}-{self.error}"


class Feedback(Base, UUIDMixin, DateMixin):
    "Stores a feedback object"

    __tablename__ = "feedback"

    text: Mapped[str] = mapped_column(Text())
    emoji: Mapped[int]
    url: Mapped[str] = mapped_column(Text())
    email: Mapped[None | str] = mapped_column(Text())
