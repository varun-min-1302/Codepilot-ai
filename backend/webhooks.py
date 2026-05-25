from fastapi import APIRouter, Depends, Header, Request, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db, Repository, PullRequest, PRFile, SessionLocal
from ai_engine import trigger_analysis, run_actual_review_engine
import json
import os
from typing import Optional

def run_actual_review_engine_task(pr_id: int, token: Optional[str] = None):
    """
    Background task wrapper that initializes its own database session,
    runs the review engine, and safely closes the session.
    If files list is missing in DB for a real PR, trigger onboard_github_pr first in the background.
    """
    db = SessionLocal()
    try:
        # Check if files list is missing for a real PR
        pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
        if pr:
            repo = db.query(Repository).filter(Repository.id == pr.repository_id).first()
            if repo and repo.owner != "codepilot-ai":  # Real PR
                files_count = db.query(PRFile).filter(PRFile.pull_request_id == pr_id).count()
                if files_count == 0:
                    print(f"Files list is missing in DB for real PR {pr_id}. Fetching files first.")
                    from routes import onboard_github_pr
                    onboard_github_pr(repo.owner, repo.name, pr.number, db, token=token)
        
        run_actual_review_engine(db, pr_id)
    except Exception as e:
        db.rollback()
        print(f"Error in background review task: {e}")
    finally:
        db.close()

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Mock Diff Files for Simulation Scenario
AUTH_PY_CONTENT = """import os
import jwt
import logging

logger = logging.getLogger(__name__)

def login_user(username, password):
    db = get_db_connection()
    cursor = db.cursor()
    # Directly concatenate input to query
    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
    cursor.execute(query)
    user = cursor.fetchone()
    if user:
        return {"status": "success", "token": "JWT_SUPER_SECRET_KEY_12345"}
    else:
        raise Exception("Invalid credentials")
"""

AUTH_PY_PATCH = """@@ -5,9 +5,8 @@
 def login_user(username, password):
     db = get_db_connection()
     cursor = db.cursor()
-    # TODO: Implement secure login
-    pass
+    # Directly concatenate input to query
+    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
+    cursor.execute(query)
+    user = cursor.fetchone()
+    if user:
+        return {"status": "success", "token": "JWT_SUPER_SECRET_KEY_12345"}
+    else:
+        raise Exception("Invalid credentials")"""

UTILS_PY_CONTENT = """# Helper utilities for roles and permissions

def find_matching_permissions(user_roles, system_permissions):
    matches = []
    for role in user_roles:
        for perm in system_permissions:
            if role.id == perm.role_id:
                # Nested lookup inside nested loop
                for user_perm in role.permissions:
                    if user_perm.code == perm.code:
                        matches.append(user_perm)
    return matches
"""

UTILS_PY_PATCH = """@@ -4,8 +4,7 @@
     matches = []
-    # Old lookup
-    pass
+    for role in user_roles:
+        for perm in system_permissions:
+            if role.id == perm.role_id:
+                # Nested lookup inside nested loop
+                for user_perm in role.permissions:
+                    if user_perm.code == perm.code:
+                        matches.append(user_perm)
     return matches"""


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Handles real GitHub pull request webhooks.
    """
    if not x_github_event:
        raise HTTPException(status_code=400, detail="Missing X-GitHub-Event header")
        
    payload = await request.json()
    
    if x_github_event == "ping":
        return {"message": "pong"}
        
    if x_github_event == "pull_request":
        action = payload.get("action")
        if action in ["opened", "synchronize", "reopened"]:
            pr_data = payload.get("pull_request", {})
            repo_data = payload.get("repository", {})
            
            # Upsert Repository
            repo_name = repo_data.get("name")
            repo_owner = repo_data.get("owner", {}).get("login")
            repo = db.query(Repository).filter(
                Repository.name == repo_name,
                Repository.owner == repo_owner
            ).first()
            if not repo:
                repo = Repository(
                    name=repo_name,
                    owner=repo_owner,
                    description=repo_data.get("description")
                )
                db.add(repo)
                db.commit()
                db.refresh(repo)
                
            # Upsert Pull Request
            pr_number = pr_data.get("number")
            pr = db.query(PullRequest).filter(
                PullRequest.repository_id == repo.id,
                PullRequest.number == pr_number
            ).first()
            
            if not pr:
                pr = PullRequest(
                    repository_id=repo.id,
                    number=pr_number,
                    title=pr_data.get("title"),
                    source_branch=pr_data.get("head", {}).get("ref"),
                    target_branch=pr_data.get("base", {}).get("ref"),
                    author=pr_data.get("user", {}).get("login"),
                    status="pending"
                )
                db.add(pr)
            else:
                pr.title = pr_data.get("title")
                pr.status = "pending"
                
            db.commit()
            db.refresh(pr)
            
            # Start background review task
            token = request.headers.get("x-github-token") or os.getenv("GITHUB_TOKEN")
            trigger_analysis(db, pr.id)
            background_tasks.add_task(run_actual_review_engine_task, pr.id, token)
            
            return {"message": "Webhook received. AI analysis scheduled.", "pr_id": pr.id}
            
    return {"message": f"Event '{x_github_event}' (action: '{payload.get('action')}') ignored."}


@router.post("/simulate")
async def simulate_webhook(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Simulates a GitHub pull_request opened webhook for a demo repository.
    """
    # 1. Upsert Repository
    repo = db.query(Repository).filter(Repository.name == "auth-service").first()
    if not repo:
        repo = Repository(
            name="auth-service",
            owner="codepilot-ai",
            description="Core authentication and token validation microservice."
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        
    # 2. Find next PR number
    existing_prs = db.query(PullRequest).filter(PullRequest.repository_id == repo.id).all()
    pr_number = 42 + len(existing_prs)
    
    # 3. Create Pull Request
    pr = PullRequest(
        repository_id=repo.id,
        number=pr_number,
        title="feat: add jwt auth and permission checks",
        source_branch="feat/jwt-auth",
        target_branch="main",
        author="alex-dev",
        status="pending"
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)
    
    # 4. Create PR Files
    file1 = PRFile(
        pull_request_id=pr.id,
        filename="auth.py",
        status="modified",
        additions=11,
        deletions=2,
        patch_diff=AUTH_PY_PATCH,
        content=AUTH_PY_CONTENT
    )
    
    file2 = PRFile(
        pull_request_id=pr.id,
        filename="utils.py",
        status="modified",
        additions=9,
        deletions=2,
        patch_diff=UTILS_PY_PATCH,
        content=UTILS_PY_CONTENT
    )
    
    db.add(file1)
    db.add(file2)
    db.commit()
    
    # Update status to pending/analyzing
    trigger_analysis(db, pr.id)
    
    return {"message": "Simulation PR triggered.", "pr_id": pr.id}
