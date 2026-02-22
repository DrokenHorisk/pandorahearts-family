# backend/api/models.py
from sqlalchemy import Column, BigInteger, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Member(Base):
    __tablename__ = "members"

    player_id = Column(BigInteger, primary_key=True)
    account_id = Column(BigInteger, nullable=False)
    nickname = Column(String(64), nullable=False)
    level = Column(Integer, nullable=False)
    class_id = Column(Integer, nullable=False)
    family = Column(String(64), nullable=False)

    points = relationship("WeeklyPoints", back_populates="member", cascade="all, delete-orphan")
    __table_args__ = (
    UniqueConstraint("family", "nickname", name="uq_family_nickname"),
)


class WeeklyPoints(Base):
    __tablename__ = "weekly_points"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    snapshot_date = Column(Date, nullable=False)             # date “logique” du snapshot
    imported_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # date/heure d’import
    family = Column(String(64), nullable=False)

    player_id = Column(BigInteger, ForeignKey("members.player_id"), nullable=False)
    gexp_points = Column(BigInteger, nullable=False)

    member = relationship("Member", back_populates="points")

    __table_args__ = (
        UniqueConstraint("snapshot_date", "family", "player_id", name="uq_snapshot_player"),
    )