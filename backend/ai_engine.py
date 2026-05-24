import os
import json
import time
import urllib.request
from sqlalchemy.orm import Session
from database import PullRequest, PRFile, AIReviewIssue, ReviewSummary

# Simulated Review Scenario Data
SIMULATED_ISSUES = [
    {
        "filename": "auth.py",
        "line_number": 8,
        "severity": "critical",
        "category": "security",
        "title": "SQL Injection Vulnerability",
        "description": "User input `username` and `password` are directly concatenated into the SQL query string. This allows an attacker to bypass authentication by injecting malicious SQL statements (e.g., `' OR '1'='1`).",
        "suggestion_diff": '@@ -5,9 +5,8 @@\n def login_user(username, password):\n     db = get_db_connection()\n     cursor = db.cursor()\n-    # Directly concatenate input to query\n-    query = f"SELECT * FROM users WHERE username = \'{username}\' AND password = \'{password}\'"\n-    cursor.execute(query)\n+    # Use parameterized query to prevent SQL Injection\n+    query = "SELECT * FROM users WHERE username = ? AND password = ?"\n+    cursor.execute(query, (username, password))\n     user = cursor.fetchone()'
    },
    {
        "filename": "auth.py",
        "line_number": 11,
        "severity": "high",
        "category": "security",
        "title": "Hardcoded JWT Secret Key",
        "description": "A sensitive cryptographic key is hardcoded directly in the source code. If this code is committed to a public repository, the key is compromised. Attackers can forge valid JWT tokens and hijack sessions.",
        "suggestion_diff": '@@ -10,3 +10,4 @@\n     if user:\n-        return {"status": "success", "token": "JWT_SUPER_SECRET_KEY_12345"}\n+        jwt_secret = os.getenv("JWT_SECRET_KEY")\n+        return {"status": "success", "token": generate_token(user, jwt_secret)}\n     else:'
    },
    {
        "filename": "utils.py",
        "line_number": 6,
        "severity": "medium",
        "category": "performance",
        "title": "Quadratic Time Complexity in Permission Lookup",
        "description": "Nested loops result in O(N^3) time complexity. For large lists of user roles and system permissions, this will degrade API response times significantly and block the event loop.",
        "suggestion_diff": '@@ -4,8 +4,7 @@\n     matches = []\n-    for role in user_roles:\n-        for perm in system_permissions:\n-            if role.id == perm.role_id:\n-                # Nested lookup inside nested loop\n-                for user_perm in role.permissions:\n-                    if user_perm.code == perm.code:\n-                        matches.append(user_perm)\n+    # Create permission lookups for O(1) set access\n+    perm_map = {perm.code: perm.role_id for perm in system_permissions}\n+    for role in user_roles:\n+        for user_perm in role.permissions:\n+            if perm_map.get(user_perm.code) == role.id:\n+                matches.append(user_perm)'
    },
    {
        "filename": "auth.py",
        "line_number": 13,
        "severity": "low",
        "category": "bug_risk",
        "title": "Broad Exception and Leaked Error Info",
        "description": "Raising a raw `Exception` is a code smell. It makes it hard for callers to catch specific error classes. Additionally, propagating generic message details without logging the traceback could mask bugs.",
        "suggestion_diff": '@@ -12,3 +12,4 @@\n     else:\n-        raise Exception("Invalid credentials")\n+        logger.warning(f"Failed login attempt for user: {username}")\n+        raise AuthenticationError("Invalid username or password")'
    }
]

SIMULATED_STEPS = [
    {"step": "scanning", "message": "Cloning repository environment and mapping dependencies...", "percentage": 15},
    {"step": "diff", "message": "Parsing code diffs and identifying modified functions...", "percentage": 30},
    {"step": "security", "message": "Auditing authentication logic for SQL injection, XSS, and hardcoded secrets...", "percentage": 55},
    {"step": "performance", "message": "Analyzing runtime complexity, nested queries, and memory consumption...", "percentage": 75},
    {"step": "smells", "message": "Evaluating code smells, structural consistency, and exception paths...", "percentage": 90},
    {"step": "complete", "message": "Review generated. Publishing inline feedback to dashboard...", "percentage": 100}
]

def analyze_code_via_api(diff_content: str) -> dict:
    """
    Attempts to use OpenAI API or Gemini API via standard library POST request to avoid library conflicts.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    api_url = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")
    
    if not api_key:
        # Check for GEMINI_API_KEY / other options
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            api_url = "https://generativetasks.googleapis.com/v1/models/gemini-pro:generateContent" # Placeholder or custom endpoint
            # We will default to simulated if keys are missing or invalid
    
    if not api_key:
        return None
        
    # Standard OpenAI payload with structured schema
    system_prompt = (
        "You are a senior principal software engineer reviewing a pull request diff.\n"
        "Analyze the diff and return a JSON object with the following fields:\n"
        "- overall_summary: string\n"
        "- security_score: integer (0 to 100)\n"
        "- performance_score: integer (0 to 100)\n"
        "- best_practice_score: integer (0 to 100)\n"
        "- issues: array of objects containing:\n"
        "  * filename: string\n"
        "  * line_number: integer\n"
        "  * severity: 'critical', 'high', 'medium', or 'low'\n"
        "  * category: 'security', 'performance', 'maintainability', 'best_practices', or 'bug_risk'\n"
        "  * title: string\n"
        "  * description: string\n"
        "  * suggestion_diff: string (unified diff snippet representing the fix)\n"
        "Be extremely concise, technical, and actionable. Do not explain standard syntax unless necessary."
    )
    
    payload = {
        "model": "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Review this PR Diff:\n\n{diff_content}"}
        ]
    }
    
    try:
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            content = res_data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        return None

def trigger_analysis(db: Session, pr_id: int):
    """
    Kicks off the analysis loop in database status.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if pr:
        pr.status = "analyzing"
        db.commit()

def generate_simulated_review(db: Session, pr_id: int) -> dict:
    """
    Saves simulated results in the SQLite database.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        return
        
    # Clear any previous findings
    db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_id).delete()
    db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_id).delete()
    
    # Insert Issues
    for issue_data in SIMULATED_ISSUES:
        issue = AIReviewIssue(
            pull_request_id=pr_id,
            filename=issue_data["filename"],
            line_number=issue_data["line_number"],
            severity=issue_data["severity"],
            category=issue_data["category"],
            title=issue_data["title"],
            description=issue_data["description"],
            suggestion_diff=issue_data["suggestion_diff"]
        )
        db.add(issue)
        
    # Create Summary
    summary = ReviewSummary(
        pull_request_id=pr_id,
        overall_summary="The Pull Request introduces critical security vulnerabilities (SQL Injection and a hardcoded secret token) and a nested loop with O(N^3) time complexity in permissions parsing. Refactoring recommendations have been attached to each line of code.",
        security_score=38,
        performance_score=64,
        best_practice_score=78
    )
    db.add(summary)
    
    pr.status = "completed"
    db.commit()
    
    return {
        "overall_summary": summary.overall_summary,
        "security_score": summary.security_score,
        "performance_score": summary.performance_score,
        "best_practice_score": summary.best_practice_score,
        "issues": SIMULATED_ISSUES
    }

def run_actual_review_engine(db: Session, pr_id: int):
    """
    Collects diff files, runs real API or falls back to simulated.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        return
        
    # Combine patches
    files = db.query(PRFile).filter(PRFile.pull_request_id == pr_id).all()
    diffs = []
    for f in files:
        if f.patch_diff:
            diffs.append(f"--- a/{f.filename}\n+++ b/{f.filename}\n{f.patch_diff}")
            
    combined_diff = "\n\n".join(diffs)
    
    api_result = analyze_code_via_api(combined_diff)
    if api_result:
        # Clear existing
        db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_id).delete()
        db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_id).delete()
        
        for issue_data in api_result.get("issues", []):
            issue = AIReviewIssue(
                pull_request_id=pr_id,
                filename=issue_data.get("filename"),
                line_number=issue_data.get("line_number", 1),
                severity=issue_data.get("severity", "medium"),
                category=issue_data.get("category", "code_smell"),
                title=issue_data.get("title", "Review Finding"),
                description=issue_data.get("description", ""),
                suggestion_diff=issue_data.get("suggestion_diff")
            )
            db.add(issue)
            
        summary = ReviewSummary(
            pull_request_id=pr_id,
            overall_summary=api_result.get("overall_summary", "Review complete."),
            security_score=api_result.get("security_score", 90),
            performance_score=api_result.get("performance_score", 90),
            best_practice_score=api_result.get("best_practice_score", 90)
        )
        db.add(summary)
        pr.status = "completed"
        db.commit()
    else:
        # Fallback to simulated
        generate_simulated_review(db, pr_id)
