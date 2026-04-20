from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    func,
)
from sqlalchemy.orm import (
    sessionmaker,
    declarative_base,
    relationship,
    Session,
)
from dotenv import load_dotenv
import os
from contextlib import contextmanager

# ------------------------------------------------------------------
# Database setup
# ------------------------------------------------------------------

load_dotenv()

DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "hanami")

DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(DATABASE_URL, echo=False, future=True)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    model = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    messages = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    chat_id = Column(
        Integer,
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
    )
    content = Column(String, nullable=False)
    is_user = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="messages")

def _init_db():
    Base.metadata.create_all(bind=engine)

_init_db()

# ------------------------------------------------------------------
# Session management (internal use only)
# ------------------------------------------------------------------

@contextmanager
def _session_scope() -> Session:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ------------------------------------------------------------------
# ChatService (ONLY public API)
# ------------------------------------------------------------------

class ChatService:
    """
    This is the ONLY thing you import elsewhere.
    No DB sessions leak outside this file.
    """

    @staticmethod
    def create_chat(title: str, model: str, messages: list[dict]):
        with _session_scope() as db:
            chat = Chat(title=title, model=model)

            for msg in messages:
                chat.messages.append(
                    Message(
                        content=msg["content"],
                        is_user=msg["is_user"],
                    )
                )

            db.add(chat)
            db.flush()
            db.refresh(chat)
            return chat

    @staticmethod
    def get_chat(chat_id: int):
        with _session_scope() as db:
            return (
                db.query(Chat)
                .filter(Chat.id == chat_id)
                .first()
            )

    @staticmethod
    def get_all_chats(limit: int = 50, offset: int = 0):
        with _session_scope() as db:
            return (
                db.query(Chat)
                .order_by(Chat.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )

    @staticmethod
    def update_chat_title(chat_id: int, new_title: str):
        with _session_scope() as db:
            chat = (
                db.query(Chat)
                .filter(Chat.id == chat_id)
                .first()
            )
            if not chat:
                return None

            chat.title = new_title
            db.flush()
            db.refresh(chat)
            return chat

    @staticmethod
    def add_message(chat_id: int, content: str, is_user: bool):
        with _session_scope() as db:
            chat = (
                db.query(Chat)
                .filter(Chat.id == chat_id)
                .first()
            )
            if not chat:
                return None

            message = Message(
                chat_id=chat_id,
                content=content,
                is_user=is_user,
            )
            db.add(message)
            db.flush()
            db.refresh(message)
            return message

    @staticmethod
    def delete_chat(chat_id: int) -> bool:
        with _session_scope() as db:
            chat = (
                db.query(Chat)
                .filter(Chat.id == chat_id)
                .first()
            )
            if not chat:
                return False

            db.delete(chat)
            return True

    @staticmethod
    def delete_message(message_id: int) -> bool:
        with _session_scope() as db:
            message = (
                db.query(Message)
                .filter(Message.id == message_id)
                .first()
            )
            if not message:
                return False

            db.delete(message)
            return True
