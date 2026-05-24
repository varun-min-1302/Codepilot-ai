from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio
from datetime import datetime
from database import get_db, Repository, PullRequest, PRFile, AIReviewIssue, ReviewSummary
from ai_engine import SIMULATED_STEPS, generate_simulated_review, run_actual_review_engine

router = APIRouter(prefix="/api", tags=["api"])

# Pydantic Schemas
class RepositoryCreate(BaseModel):
    name: str
    owner: str
    description: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

# API Endpoints

@router.get("/repos")
def list_repositories(db: Session = Depends(get_db)):
    return db.query(Repository).order_by(Repository.created_at.desc()).all()

@router.post("/repos")
def create_repository(repo_in: RepositoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Repository).filter(Repository.name == repo_in.name, Repository.owner == repo_in.owner).first()
    if existing:
        return existing
    repo = Repository(
        name=repo_in.name,
        owner=repo_in.owner,
        description=repo_in.description
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    return repo

@router.get("/repos/{repo_id}/prs")
def list_pull_requests(repo_id: int, db: Session = Depends(get_db)):
    return db.query(PullRequest).filter(PullRequest.repository_id == repo_id).order_by(PullRequest.number.desc()).all()

@router.get("/prs/recent")
def list_recent_pull_requests(db: Session = Depends(get_db)):
    prs = db.query(PullRequest).order_by(PullRequest.created_at.desc()).limit(10).all()
    # Populate repo name in response
    results = []
    for pr in prs:
        repo = db.query(Repository).filter(Repository.id == pr.repository_id).first()
        results.append({
            "id": pr.id,
            "number": pr.number,
            "title": pr.title,
            "author": pr.author,
            "status": pr.status,
            "source_branch": pr.source_branch,
            "target_branch": pr.target_branch,
            "repo_name": repo.name if repo else "unknown",
            "repo_owner": repo.owner if repo else "unknown",
            "created_at": pr.created_at
        })
    return results

@router.get("/prs/{pr_id}")
def get_pull_request_details(pr_id: int, db: Session = Depends(get_db)):
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull Request not found")
        
    repo = db.query(Repository).filter(Repository.id == pr.repository_id).first()
    files = db.query(PRFile).filter(PRFile.pull_request_id == pr_id).all()
    summary = db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_id).first()
    issues = db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_id).all()
    
    return {
        "pr": {
            "id": pr.id,
            "number": pr.number,
            "title": pr.title,
            "author": pr.author,
            "status": pr.status,
            "source_branch": pr.source_branch,
            "target_branch": pr.target_branch,
            "created_at": pr.created_at,
        },
        "repo": {
            "id": repo.id,
            "name": repo.name,
            "owner": repo.owner,
            "description": repo.description
        } if repo else None,
        "summary": {
            "overall_summary": summary.overall_summary,
            "security_score": summary.security_score,
            "performance_score": summary.performance_score,
            "best_practice_score": summary.best_practice_score
        } if summary else None,
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "status": f.status,
                "additions": f.additions,
                "deletions": f.deletions,
                "patch_diff": f.patch_diff,
                "content": f.content
            } for f in files
        ],
        "issues": [
            {
                "id": i.id,
                "filename": i.filename,
                "line_number": i.line_number,
                "severity": i.severity,
                "category": i.category,
                "title": i.title,
                "description": i.description,
                "suggestion_diff": i.suggestion_diff
            } for i in issues
        ]
    }

@router.get("/prs/{pr_id}/review/stream")
async def stream_review_analysis(pr_id: int, db: Session = Depends(get_db)):
    """
    Streams analysis stages via SSE (Server-Sent Events) and runs the review engine.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")

    async def sse_generator():
        # If already completed, stream final stage immediately
        if pr.status == "completed":
            yield f"data: {json.dumps({'step': 'complete', 'message': 'Review already complete! Fetching results...', 'percentage': 100, 'status': 'completed'})}\n\n"
            await asyncio.sleep(0.5)
            return

        pr.status = "analyzing"
        db.commit()

        # Stream mock stages with realistic delays
        for idx, step_info in enumerate(SIMULATED_STEPS):
            yield f"data: {json.dumps({'step': step_info['step'], 'message': step_info['message'], 'percentage': step_info['percentage'], 'status': 'analyzing'})}\n\n"
            await asyncio.sleep(1.2) # Sleep 1.2s to simulate real work

        # Run AI analysis (saves findings to database)
        run_actual_review_engine(db, pr_id)
        
        # Verify the database has the issues
        db.refresh(pr)
        
        yield f"data: {json.dumps({'step': 'finished', 'message': 'Findings compiled successfully. Rendering dashboard...', 'percentage': 100, 'status': 'completed'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.post("/prs/{pr_id}/chat")
def pr_chat_assistant(pr_id: int, request: ChatRequest, db: Session = Depends(get_db)):
    """
    Simulates Cursor-like Copilot chat assistant answers for code review.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")
        
    query = request.message.lower()
    
    # Analyze query content to give contextual responses
    if "sql" in query or "vulnerable" in query or "security" in query or "secret" in query:
        response_text = (
            "### 🔒 CodePilot AI Security Analysis\n\n"
            "This Pull Request contains **two critical security vulnerabilities** in `auth.py`:\n\n"
            "#### 1. SQL Injection (`auth.py:L8`)\n"
            "```python\n"
            "query = f\"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'\"\n"
            "```\n"
            "Concatenating raw input parameters into raw SQL string values leaves the query open to authentication bypass "
            "attacks. An attacker could supply `admin' --` or `' OR '1'='1` to log in without credentials.\n\n"
            "**Fix:** Use parameterized query bindings (placeholder syntax):\n"
            "```python\n"
            "query = \"SELECT * FROM users WHERE username = ? AND password = ?\"\n"
            "cursor.execute(query, (username, password))\n"
            "```\n\n"
            "#### 2. Hardcoded Secret Token (`auth.py:L11`)\n"
            "```python\n"
            "return {\"status\": \"success\", \"token\": \"JWT_SUPER_SECRET_KEY_12345\"}\n"
            "```\n"
            "Storing credentials or API keys directly in code exposes them to leaks in source control.\n\n"
            "**Fix:** Move secrets to an environment file (`.env`) and query them via `os.environ`:\n"
            "```python\n"
            "import os\n"
            "jwt_secret = os.getenv(\"JWT_SECRET_KEY\")\n"
            "```"
        )
    elif "optimize" in query or "performance" in query or "loop" in query or "slow" in query or "utils.py" in query:
        response_text = (
            "### ⚡ CodePilot AI Performance Analysis\n\n"
            "I detected an **O(N^3) cubic time complexity** issue in `utils.py:L6` inside `find_matching_permissions`:\n\n"
            "```python\n"
            "for role in user_roles:\n"
            "    for perm in system_permissions:\n"
            "        if role.id == perm.role_id:\n"
            "            for user_perm in role.permissions:\n"
            "                ...\n"
            "```\n\n"
            "#### Why this slows down execution:\n"
            "- It performs three nested loops across user roles, system permissions, and role permissions.\n"
            "- If a developer has `R` roles, there are `P` system permissions, and `U` permissions per role, the comparisons "
            "scale to `R * P * U`. If the number of permissions and roles increases, this blocks Python's thread, causing API delays.\n\n"
            "#### Optimized O(N) Hash Map Fix:\n"
            "Map roles and permissions in a hash set/dictionary beforehand. Here is how we make it run in linear time:\n"
            "```python\n"
            "def find_matching_permissions(user_roles, system_permissions):\n"
            "    matches = []\n"
            "    # Create a fast lookup map mapping code -> role_id\n"
            "    perm_map = {perm.code: perm.role_id for perm in system_permissions}\n"
            "    \n"
            "    for role in user_roles:\n"
            "        for user_perm in role.permissions:\n"
            "            if perm_map.get(user_perm.code) == role.id:\n"
            "                matches.append(user_perm)\n"
            "    return matches\n"
            "```"
        )
    elif "explain" in query or "how does" in query or "auth.py" in query:
        response_text = (
            "### 📖 auth.py Explanation\n\n"
            "The `auth.py` file exposes the `login_user(username, password)` routine:\n\n"
            "1. **Connection**: It fetches a database cursor to look up users.\n"
            "2. **Querying**: It builds a query looking for rows matching both parameters.\n"
            "3. **Token Issuance**: If a match is found, it returns a hardcoded authentication token string `JWT_SUPER_SECRET_KEY_12345` with a success status.\n"
            "4. **Error handling**: If no match is found, it raises a generic Python `Exception` class.\n\n"
            "As flagged, this contains critical security flaws that should be resolved before deployment."
        )
    else:
        response_text = (
            "### 🤖 CodePilot AI PR Assistant\n\n"
            "Hello! I am your AI reviewer. I analyzed this pull request and found **4 issues**:\n"
            "- 🛡️ **SQL Injection Risk** in `auth.py` (Critical)\n"
            "- 🔑 **Hardcoded Secret Key** in `auth.py` (High)\n"
            "- ⚡ **Nested loops** causing performance lag in `utils.py` (Medium)\n"
            "- ⚠️ **Generic exception error** in `auth.py` (Low)\n\n"
            "Would you like me to:\n"
            "1. **Explain why** SQL concatenation leads to authentication bypass?\n"
            "2. **Rewrite** the nested loop in `utils.py` using a hash lookup dictionary?\n"
            "3. Provide code templates for reading environment variables?"
        )
        
    return {
        "message": response_text,
        "created_at": datetime.utcnow().isoformat()
    }


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """
    Returns summarized metrics across all reviewed repositories.
    """
    total_repos = db.query(Repository).count()
    total_prs = db.query(PullRequest).count()
    completed_reviews = db.query(PullRequest).filter(PullRequest.status == "completed").count()
    
    # Calculate average scores
    summaries = db.query(ReviewSummary).all()
    avg_sec = int(sum(s.security_score for s in summaries) / len(summaries)) if summaries else 100
    avg_perf = int(sum(s.performance_score for s in summaries) / len(summaries)) if summaries else 100
    avg_best = int(sum(s.best_practice_score for s in summaries) / len(summaries)) if summaries else 100
    
    # Count issue categories
    issues = db.query(AIReviewIssue).all()
    sec_count = len([i for i in issues if i.category == "security"])
    perf_count = len([i for i in issues if i.category == "performance"])
    best_count = len([i for i in issues if i.category in ["best_practices", "bug_risk", "maintainability"]])
    
    return {
        "summary": {
            "total_repositories": total_repos if total_repos > 0 else 1,
            "total_pull_requests": total_prs,
            "completed_reviews": completed_reviews,
            "security_score_avg": avg_sec,
            "performance_score_avg": avg_perf,
            "best_practice_score_avg": avg_best
        },
        "issues_by_category": {
            "Security": sec_count,
            "Performance": perf_count,
            "Code Quality": best_count
        },
        "monthly_review_trends": [
            {"month": "Jan", "count": 12, "bugs": 4},
            {"month": "Feb", "count": 18, "bugs": 8},
            {"month": "Mar", "count": 22, "bugs": 11},
            {"month": "Apr", "count": 31, "bugs": 15},
            {"month": "May", "count": total_prs, "bugs": len(issues)}
        ]
    }
