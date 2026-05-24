import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# PostgreSQL engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

class Repository(Base):
    __tablename__ = "repositories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    owner = Column(String)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    pull_requests = relationship("PullRequest", back_populates="repository", cascade="all, delete-orphan")

class PullRequest(Base):
    __tablename__ = "pull_requests"
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    number = Column(Integer, index=True)
    title = Column(String)
    source_branch = Column(String)
    target_branch = Column(String)
    author = Column(String)
    status = Column(String, default="pending")  # pending, analyzing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    repository = relationship("Repository", back_populates="pull_requests")
    files = relationship("PRFile", back_populates="pull_request", cascade="all, delete-orphan")
    issues = relationship("AIReviewIssue", back_populates="pull_request", cascade="all, delete-orphan")
    summary = relationship("ReviewSummary", back_populates="pull_request", uselist=False, cascade="all, delete-orphan")

class PRFile(Base):
    __tablename__ = "pr_files"
    id = Column(Integer, primary_key=True, index=True)
    pull_request_id = Column(Integer, ForeignKey("pull_requests.id"))
    filename = Column(String, index=True)
    status = Column(String)  # added, modified, deleted
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    patch_diff = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    
    pull_request = relationship("PullRequest", back_populates="files")

class AIReviewIssue(Base):
    __tablename__ = "ai_review_issues"
    id = Column(Integer, primary_key=True, index=True)
    pull_request_id = Column(Integer, ForeignKey("pull_requests.id"))
    filename = Column(String)
    line_number = Column(Integer)
    severity = Column(String)  # critical, high, medium, low
    category = Column(String)  # security, performance, maintainability, best_practices, bug_risk
    title = Column(String)
    description = Column(Text)
    suggestion_diff = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    pull_request = relationship("PullRequest", back_populates="issues")

class ReviewSummary(Base):
    __tablename__ = "review_summaries"
    id = Column(Integer, primary_key=True, index=True)
    pull_request_id = Column(Integer, ForeignKey("pull_requests.id"))
    overall_summary = Column(Text)
    security_score = Column(Integer)       # 0 to 100
    performance_score = Column(Integer)    # 0 to 100
    best_practice_score = Column(Integer)  # 0 to 100
    created_at = Column(DateTime, default=datetime.utcnow)
    
    pull_request = relationship("PullRequest", back_populates="summary")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
