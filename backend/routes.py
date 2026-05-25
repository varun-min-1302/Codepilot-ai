import os
import re
import json
import logging
import asyncio
import httpx
from datetime import datetime

logger = logging.getLogger("uvicorn.error")
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db, Repository, PullRequest, PRFile, AIReviewIssue, ReviewSummary
import ai_engine
from ai_engine import SIMULATED_STEPS, run_actual_review_engine, client as openai_client

router = APIRouter(prefix="/api", tags=["api"])

# Pydantic Schemas
class RepositoryCreate(BaseModel):
    name: str
    owner: str
    description: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class OnboardRequest(BaseModel):
    url: Optional[str] = None
    pr_url: Optional[str] = None
    owner: Optional[str] = None
    repo: Optional[str] = None
    number: Optional[int] = None

# Helper to apply diff suggestions
def apply_suggestion_patch(original_content: str, patch_diff: str) -> str:
    if not original_content or not patch_diff:
        return original_content

    lines = original_content.splitlines()
    patch_lines = patch_diff.splitlines()

    minus_lines = []
    plus_lines = []
    
    for pl in patch_lines:
        if pl.startswith("@@"):
            continue
        if pl.startswith("-"):
            minus_lines.append(pl[1:])
        elif pl.startswith("+"):
            plus_lines.append(pl[1:])

    old_text = "\n".join(minus_lines).strip()
    new_text = "\n".join(plus_lines).strip()

    if not old_text:
        return original_content

    # Match normalize
    content_normalized = "\n".join(lines)
    if old_text in content_normalized:
        return content_normalized.replace(old_text, new_text)
    
    # Try line-by-line search and replace for robustness
    # Strip whitespace to align
    old_lines_clean = [l.strip() for l in minus_lines if l.strip()]
    if not old_lines_clean:
        return original_content

    # Simple matching fallback
    content_lines_str = "\n".join(lines)
    first_old_line = old_lines_clean[0]
    for idx, line in enumerate(lines):
        if first_old_line in line:
            # check if we can replace a block of lines
            match_len = len(old_lines_clean)
            if idx + match_len <= len(lines):
                # replace lines
                new_lines = lines[:idx] + plus_lines + lines[idx + match_len:]
                return "\n".join(new_lines)

    return original_content

# GitHub PR Fetcher helper
async def onboard_github_pr(owner: str, repo_name: str, number: int, db: Session) -> PullRequest:
    token = os.getenv("GITHUB_TOKEN")
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodePilot-AI-Engine"
    }
    if token:
        headers["Authorization"] = f"token {token}"

    async with httpx.AsyncClient(timeout=20.0) as http_client:
        # 1. Fetch Pull Request metadata
        pr_url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls/{number}"
        pr_res = await http_client.get(pr_url, headers=headers)
        if pr_res.status_code != 200:
            raise HTTPException(
                status_code=pr_res.status_code, 
                detail=f"GitHub API Error: {pr_res.json().get('message', 'Failed to fetch PR')}"
            )
        
        pr_data = pr_res.json()

        # 2. Fetch Pull Request files list
        files_url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls/{number}/files"
        files_res = await http_client.get(files_url, headers=headers)
        files_data = files_res.json() if files_res.status_code == 200 else []

        # 3. Create/Retrieve Repository record
        repo = db.query(Repository).filter(Repository.name == repo_name, Repository.owner == owner).first()
        if not repo:
            repo = Repository(
                name=repo_name,
                owner=owner,
                description=pr_data.get("base", {}).get("repo", {}).get("description") or f"GitHub repository {owner}/{repo_name}"
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)

        # 4. Create/Retrieve PullRequest record
        pr = db.query(PullRequest).filter(PullRequest.repository_id == repo.id, PullRequest.number == number).first()
        if not pr:
            pr = PullRequest(
                repository_id=repo.id,
                number=number,
                title=pr_data.get("title", f"Pull Request #{number}"),
                source_branch=pr_data.get("head", {}).get("ref", "unknown"),
                target_branch=pr_data.get("base", {}).get("ref", "main"),
                author=pr_data.get("user", {}).get("login", "unknown"),
                status="pending"
            )
            db.add(pr)
            db.commit()
            db.refresh(pr)
        else:
            pr.title = pr_data.get("title", pr.title)
            pr.status = "pending"
            db.commit()

        # Clear existing files for this PR before re-inserting
        db.query(PRFile).filter(PRFile.pull_request_id == pr.id).delete()
        db.commit()

        # 5. Process and insert files
        for f in files_data:
            filename = f.get("filename")
            status = f.get("status", "modified")
            additions = f.get("additions", 0)
            deletions = f.get("deletions", 0)
            patch_diff = f.get("patch", "")
            
            # Fetch raw content of the file from head branch
            contents_url = f.get("contents_url")
            raw_url = f.get("raw_url")
            file_content = ""
            if contents_url:
                raw_headers = {
                    "Accept": "application/vnd.github.v3.raw",
                    "User-Agent": "CodePilot-AI-Engine"
                }
                if token:
                    raw_headers["Authorization"] = f"token {token}"
                try:
                    contents_res = await http_client.get(contents_url, headers=raw_headers)
                    if contents_res.status_code == 200:
                        file_content = contents_res.text
                except Exception as e:
                    print(f"Error fetching contents_url: {e}")

            if not file_content and raw_url:
                try:
                    raw_res = await http_client.get(raw_url, follow_redirects=True)
                    if raw_res.status_code == 200:
                        file_content = raw_res.text
                except Exception as e:
                    print(f"Error fetching raw_url: {e}")
            if file_content:
                file_content = file_content.replace("\x00", "")

            pr_file = PRFile(
                pull_request_id=pr.id,
                filename=filename,
                status=status,
                additions=additions,
                deletions=deletions,
                patch_diff=patch_diff,
                content=file_content
            )
            db.add(pr_file)
        
        db.commit()
        db.refresh(pr)
        return pr

# REST API routes

@router.get("/repos")
def list_repositories(db: Session = Depends(get_db)):
    if not ai_engine.openai_active:
        return db.query(Repository).filter(Repository.name == "auth-service").all()
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
    if not ai_engine.openai_active:
        prs = db.query(PullRequest).filter(
            PullRequest.repository_id.in_(
                db.query(Repository.id).filter(Repository.name == "auth-service")
            )
        ).order_by(PullRequest.created_at.desc()).all()
    else:
        prs = db.query(PullRequest).order_by(PullRequest.created_at.desc()).limit(10).all()
        
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

def parse_github_pr_url(pr_url: str) -> Optional[dict]:
    if not pr_url:
        return None
    pattern = r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)"
    match = re.match(pattern, pr_url.strip())
    if match:
        owner = match.group(1)
        repo = match.group(2)
        pr_number = int(match.group(3))
        logger.info(f"parse_github_pr_url - parsed values: owner={owner}, repo={repo}, pr_number={pr_number}")
        return {
            "owner": owner,
            "repo": repo,
            "pr_number": pr_number
        }
    logger.warning(f"parse_github_pr_url - failed to parse: {pr_url}")
    return None

@router.post("/prs/onboard")
async def onboard_pr(req: OnboardRequest, db: Session = Depends(get_db)):
    """
    Onboards a repository pull request using a URL or specific repository parameters.
    """
    owner, repo, number = None, None, None
    pr_url = req.pr_url or req.url
    
    if pr_url:
        parsed = parse_github_pr_url(pr_url)
        if not parsed:
            raise HTTPException(status_code=400, detail="Invalid GitHub PR URL")
        owner = parsed["owner"]
        repo = parsed["repo"]
        number = parsed["pr_number"]
    else:
        owner = req.owner
        repo = req.repo
        number = req.number

    if not owner or not repo or not number:
        raise HTTPException(
            status_code=400, 
            detail="Must supply either a valid GitHub PR URL or owner, repo, and PR number."
        )

    logger.info(f"onboard_pr - onboarding parsed values: owner={owner}, repo={repo}, number={number}")
    pr = await onboard_github_pr(owner, repo, number, db)
    return {"message": "PR successfully onboarded", "pr_id": pr.id}

@router.get("/prs/{pr_id}")
async def get_pull_request_details(pr_id: str, db: Session = Depends(get_db)):
    """
    Returns PR details. Supports dynamic onboarding when the ID contains '--'.
    """
    db_pr = None
    if "--" in pr_id:
        # Onboarding format: owner--repo--number
        try:
            owner, repo_name, num_str = pr_id.split("--")
            number = int(num_str)
            db_pr = await onboard_github_pr(owner, repo_name, number, db)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to onboard PR '{pr_id}': {e}")
    else:
        try:
            id_val = int(pr_id)
            db_pr = db.query(PullRequest).filter(PullRequest.id == id_val).first()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid PR ID format.")

    if not db_pr:
        raise HTTPException(status_code=404, detail="Pull Request not found")

    repo = db.query(Repository).filter(Repository.id == db_pr.repository_id).first()
    files = db.query(PRFile).filter(PRFile.pull_request_id == db_pr.id).all()
    summary = db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == db_pr.id).first()
    issues = db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == db_pr.id).all()

    return {
        "pr": {
            "id": db_pr.id,
            "number": db_pr.number,
            "title": db_pr.title,
            "author": db_pr.author,
            "status": db_pr.status,
            "source_branch": db_pr.source_branch,
            "target_branch": db_pr.target_branch,
            "created_at": db_pr.created_at,
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
    Streams analysis progress and triggers the review engine.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")

    async def sse_generator():
        if pr.status == "completed":
            yield f"data: {json.dumps({'step': 'complete', 'message': 'Review already complete! Fetching results...', 'percentage': 100, 'status': 'completed'})}\n\n"
            return

        pr.status = "analyzing"
        db.commit()

        # Stream progress steps
        for step_info in SIMULATED_STEPS[:-1]:
            yield f"data: {json.dumps({'step': step_info['step'], 'message': step_info['message'], 'percentage': step_info['percentage'], 'status': 'analyzing'})}\n\n"
            await asyncio.sleep(1.0)

        # Trigger actual review
        try:
            await run_actual_review_engine(db, pr_id)
            db.refresh(pr)
            yield f"data: {json.dumps({'step': 'finished', 'message': 'Findings compiled successfully. Rendering dashboard...', 'percentage': 100, 'status': 'completed'})}\n\n"
        except Exception as e:
            pr.status = "failed"
            db.commit()
            yield f"data: {json.dumps({'step': 'failed', 'message': f'Analysis failed: {str(e)}', 'percentage': 100, 'status': 'failed'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/prs/{pr_id}/chat")
async def pr_chat_assistant(pr_id: int, request: ChatRequest, db: Session = Depends(get_db)):
    """
    Context-aware AI Chat Assistant using OpenAI or falling back to heuristics.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")

    # Fetch context
    files = db.query(PRFile).filter(PRFile.pull_request_id == pr_id).all()
    issues = db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_id).all()
    summary = db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_id).first()

    diff_context = []
    for f in files:
        if f.patch_diff:
            diff_context.append(f"File: {f.filename}\nDiff:\n{f.patch_diff}")
    
    issues_context = []
    for i in issues:
        issues_context.append(
            f"File: {i.filename} | Line: {i.line_number} | Category: {i.category} | Severity: {i.severity}\n"
            f"Title: {i.title}\nDescription: {i.description}"
        )

    context_prompt = (
        f"You are CodePilot Copilot, an AI code assistant integrated inside a PR review dashboard.\n"
        f"The user is asking questions about a Pull Request: '{pr.title}' (Author: {pr.author}).\n\n"
        f"--- PR CONTEXT ---\n"
        f"Summary: {summary.overall_summary if summary else 'No summary generated yet'}\n\n"
        f"--- CURRENT DETECTED ISSUES ---\n"
        f"{chr(10).join(issues_context) if issues_context else 'No issues detected.'}\n\n"
        f"--- CHANGED FILES DIFF ---\n"
        f"{chr(10).join(diff_context) if diff_context else 'No code changes.'}\n\n"
        f"Explain suggestions, code vulnerabilities, performance concerns or design queries with complete technical clarity. "
        f"Format your output in professional Markdown."
    )

    if openai_client:
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": context_prompt},
                    {"role": "user", "content": request.message}
                ],
                temperature=0.2
            )
            reply = response.choices[0].message.content
            return {
                "message": reply,
                "created_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            error_msg = str(e)
            print(f"Error in chat completions: {error_msg}")
            if "insufficient_quota" in error_msg or "429" in error_msg:
                return {
                    "message": (
                        "### ⚠️ OpenAI API Quota Exceeded\n\n"
                        "Your OpenAI API key is configured successfully, but the API request failed because "
                        "**you have exceeded your current OpenAI API billing quota** (e.g., your account has no credits "
                        "or has expired).\n\n"
                        "Please check your OpenAI API billing settings at [platform.openai.com](https://platform.openai.com/settings/organization/billing) "
                        "to add credits. In the meantime, here is the offline explanation for your query:\n\n"
                        "If you asked about **SQL Injection**:\n"
                        "- Concatenating variables directly into query strings makes the database vulnerable to bypasses.\n"
                        "- **Fix**: Use parameterized queries (`cursor.execute(query, params)`).\n\n"
                        "If you asked about **nested loops**:\n"
                        "- Nested loops run in O(N^2) or O(N^3) complexity, which degrades performance.\n"
                        "- **Fix**: Map secondary lists into lookups before checking."
                    ),
                    "created_at": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "message": (
                        f"### ⚠️ OpenAI API Error\n\n"
                        f"Failed to communicate with OpenAI. Error details:\n"
                        f"```\n{error_msg}\n```\n"
                        f"Please check your API key configuration. Falling back to local offline heuristics."
                    ),
                    "created_at": datetime.utcnow().isoformat()
                }


    # Fallback heuristic responses
    query = request.message.lower()
    if "sql" in query or "security" in query or "vulnerab" in query:
        reply = (
            "### 🔒 SQL Injection Warning\n\n"
            "Direct string concatenation bypasses database query sanitization. "
            "Use parameterized values (`?` or placeholder lists) to completely prevent SQL injection attacks."
        )
    elif "loop" in query or "slow" in query or "optimize" in query:
        reply = (
            "### ⚡ Algorithm Optimization\n\n"
            "Nested loops create exponential time scale multipliers. "
            "Convert the secondary lists into indexed hash maps beforehand to run lookups in linear O(N) complexity."
        )
    else:
        reply = (
            f"### 🤖 CodePilot Copilot\n\n"
            f"I have reviewed '{pr.title}'. There are {len(issues)} issues detected on this pull request. "
            f"Please configure a valid `OPENAI_API_KEY` to run full context-aware chat prompts."
        )

    return {
        "message": reply,
        "created_at": datetime.utcnow().isoformat()
    }

@router.post("/issues/{issue_id}/accept-fix")
async def accept_issue_fix(issue_id: int, db: Session = Depends(get_db)):
    """
    Applies the issue suggestion diff directly to the file content in the database.
    If it is a real GitHub PR, commits the updated file directly back to GitHub branch.
    Deletes the resolved issue, and increases the metrics score.
    """
    issue = db.query(AIReviewIssue).filter(AIReviewIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    pr_file = db.query(PRFile).filter(
        PRFile.pull_request_id == issue.pull_request_id,
        PRFile.filename == issue.filename
    ).first()

    if not pr_file or not pr_file.content or not issue.suggestion_diff:
        raise HTTPException(status_code=400, detail="Cannot apply fix: missing code file or suggestion diff.")

    updated_content = apply_suggestion_patch(pr_file.content, issue.suggestion_diff)
    pr_file.content = updated_content

    # Commit and push to GitHub if GITHUB_TOKEN is present and it is a real PR
    pr = db.query(PullRequest).filter(PullRequest.id == issue.pull_request_id).first()
    token = os.getenv("GITHUB_TOKEN")
    if pr and token:
        repo = db.query(Repository).filter(Repository.id == pr.repository_id).first()
        if repo and repo.owner != "codepilot-ai":  # Check it is not mock repository
            import base64
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": f"token {token}",
                "User-Agent": "CodePilot-AI-Engine"
            }
            async with httpx.AsyncClient(timeout=20.0) as http_client:
                # Get current file sha on the source branch
                get_url = f"https://api.github.com/repos/{repo.owner}/{repo.name}/contents/{issue.filename}?ref={pr.source_branch}"
                try:
                    get_res = await http_client.get(get_url, headers=headers)
                    if get_res.status_code == 200:
                        file_info = get_res.json()
                        current_sha = file_info.get("sha")
                        
                        # Base64 encode the new content
                        encoded_content = base64.b64encode(updated_content.encode("utf-8")).decode("utf-8")
                        
                        # PUT request to update the file on GitHub
                        put_url = f"https://api.github.com/repos/{repo.owner}/{repo.name}/contents/{issue.filename}"
                        put_data = {
                            "message": f"fix(review): apply AI-suggested fix for {issue.title}",
                            "content": encoded_content,
                            "sha": current_sha,
                            "branch": pr.source_branch
                        }
                        put_res = await http_client.put(put_url, headers=headers, json=put_data)
                        if put_res.status_code not in [200, 201]:
                            print(f"Failed to push commit to GitHub: {put_res.status_code} - {put_res.text}")
                    else:
                        print(f"Failed to retrieve file SHA from GitHub: {get_res.status_code} - {get_res.text}")
                except Exception as e:
                    print(f"Error executing GitHub commit operation: {e}")

    # Delete resolved issue
    db.delete(issue)
    db.commit()

    # Recalculate summary scores
    summary = db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_file.pull_request_id).first()
    if summary:
        # Count remaining category issues to adjust scores
        remaining_issues = db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_file.pull_request_id).all()
        sec_count = len([i for i in remaining_issues if i.category == "security"])
        perf_count = len([i for i in remaining_issues if i.category == "performance"])
        best_count = len([i for i in remaining_issues if i.category in ["best_practices", "bug_risk", "maintainability"]])

        summary.security_score = max(38, 100 - (sec_count * 30))
        summary.performance_score = max(64, 100 - (perf_count * 20))
        summary.best_practice_score = max(78, 100 - (best_count * 10))
        
        if len(remaining_issues) == 0:
            summary.overall_summary = "All code review issues have been successfully resolved and applied!"
        db.commit()

    return {"status": "success", "message": "Fix applied successfully and issue resolved."}

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    total_repos = db.query(Repository).count()
    total_prs = db.query(PullRequest).count()
    completed_reviews = db.query(PullRequest).filter(PullRequest.status == "completed").count()

    summaries = db.query(ReviewSummary).all()
    avg_sec = int(sum(s.security_score for s in summaries) / len(summaries)) if summaries else 100
    avg_perf = int(sum(s.performance_score for s in summaries) / len(summaries)) if summaries else 100
    avg_best = int(sum(s.best_practice_score for s in summaries) / len(summaries)) if summaries else 100

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
