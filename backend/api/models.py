# backend/api/models.py
from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    String,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Boolean
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime


Base = declarative_base()

class Member(Base):
    __tablename__ = "members"

    player_id = Column(BigInteger, primary_key=True)
    account_id = Column(BigInteger, nullable=True)
    nickname = Column(String(64), nullable=False)
    level = Column(Integer, nullable=False)
    class_id = Column(Integer, nullable=False)
    family = Column(String(64), nullable=False)
    status = Column(String(32), nullable=True)  
    # ✅ nullable pour compat dump ancien
    # API fera fallback "Principale" si NULL
    role = Column(String(16), nullable=True)  # Principale | Secondaire | Mule | NULL

    # ✅ lien vers un principal (pour secondaire/mule)
    main_player_id = Column(
        BigInteger,
        ForeignKey("members.player_id", ondelete="SET NULL"),
        nullable=True,
    )

    main_member = relationship(
        "Member",
        remote_side=[player_id],
        foreign_keys=[main_player_id],
        back_populates="linked_members",
    )

    linked_members = relationship(
        "Member",
        back_populates="main_member",
        foreign_keys=[main_player_id],
    )

    points = relationship("WeeklyPoints", back_populates="member", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("family", "nickname", name="uq_family_nickname"),

        # ✅ role peut être NULL, sinon doit être FR
        CheckConstraint(
            "(role IS NULL) OR (role IN ('Principale','Secondaire','Mule'))",
            name="ck_members_role",
        ),

        # ✅ main_player_id ne doit pas pointer vers soi-même
        CheckConstraint(
            "(main_player_id IS NULL) OR (main_player_id <> player_id)",
            name="ck_members_main_not_self",
        ),
    )


class WeeklyPoints(Base):
    __tablename__ = "weekly_points"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    snapshot_date = Column(Date, nullable=False)
    imported_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    family = Column(String(64), nullable=False)

    player_id = Column(BigInteger, ForeignKey("members.player_id"), nullable=False)
    gexp_points = Column(BigInteger, nullable=False)

    member = relationship("Member", back_populates="points")

    __table_args__ = (
        UniqueConstraint("snapshot_date", "family", "player_id", name="uq_snapshot_player"),
    )

class Donation(Base):
    __tablename__ = "donations"

    player_id = Column(Integer, ForeignKey("members.player_id"), primary_key=True)
    family = Column(String, primary_key=True)

    gave = Column(Boolean, nullable=False, default=False)
    amount = Column(Integer, nullable=False, default=0)