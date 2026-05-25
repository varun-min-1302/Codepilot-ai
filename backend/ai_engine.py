import os
import re
import json
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from database import PullRequest, PRFile, AIReviewIssue, ReviewSummary
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client if key is configured
openai_api_key = os.getenv("OPENAI_API_KEY")
client = AsyncOpenAI(api_key=openai_api_key) if openai_api_key else None
openai_active = (client is not None)



# Local Fallback Simulated Steps
SIMULATED_STEPS = [
    {"step": "scanning", "message": "Cloning repository environment and mapping dependencies...", "percentage": 15},
    {"step": "diff", "message": "Parsing code diffs and identifying modified functions...", "percentage": 35},
    {"step": "security", "message": "Auditing authentication logic for SQL injection, XSS, and secrets...", "percentage": 60},
    {"step": "performance", "message": "Analyzing runtime complexity, nested queries, and memory consumption...", "percentage": 80},
    {"step": "smells", "message": "Evaluating code smells, structural consistency, and exception paths...", "percentage": 95},
    {"step": "complete", "message": "Review generated. Publishing inline feedback to dashboard...", "percentage": 100}
]

# Static Templates for Regex Matching Fallbacks
HEURISTIC_TEMPLATES = {
    "sql_injection": {
        "title": "Potential SQL Injection Vulnerability",
        "severity": "critical",
        "category": "security",
        "description": "User-controlled input is concatenated directly into an SQL query string. This allows attackers to manipulate SQL execution commands.",
        "suggestion_diff": "@@ -5,2 +5,2 @@\n-    query = f\"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'\"\n-    cursor.execute(query)\n+    query = \"SELECT * FROM users WHERE username = ? AND password = ?\"\n+    cursor.execute(query, (username, password))"
    },
    "hardcoded_secret": {
        "title": "Hardcoded JWT Secret Key",
        "severity": "high",
        "category": "security",
        "description": "Sensitive cryptographic keys, secret tokens, or API credentials are hardcoded directly in source files. Storing passwords in version control is insecure.",
        "suggestion_diff": "@@ -15,1 +15,2 @@\n-        return {\"status\": \"success\", \"token\": \"JWT_SUPER_SECRET_KEY_12345\"}\n+        jwt_secret = os.getenv(\"JWT_SECRET_KEY\")\n+        return {\"status\": \"success\", \"token\": generate_token(user, jwt_secret)}"
    },
    "quadratic_loop": {
        "title": "Quadratic Time Complexity in Nested Loop",
        "severity": "medium",
        "category": "performance",
        "description": "Nested iteration results in O(N^2) or O(N^3) complexity. For large data inputs, this will block the main thread and degrade system response times.",
        "suggestion_diff": "@@ -5,7 +5,6 @@\n-    for role in user_roles:\n-        for perm in system_permissions:\n-            if role.id == perm.role_id:\n-                for user_perm in role.permissions:\n-                    if user_perm.code == perm.code:\n-                        matches.append(user_perm)\n+    perm_map = {perm.code: perm.role_id for perm in system_permissions}\n+    for role in user_roles:\n+        for user_perm in role.permissions:\n+            if perm_map.get(user_perm.code) == role.id:\n+                matches.append(user_perm)"
    },
    "broad_exception": {
        "title": "Broad Exception Handling",
        "severity": "low",
        "category": "bug_risk",
        "description": "Catching a generic exception masks unexpected bugs and makes debugging extremely difficult. Log the error traceback or raise a more specific exception class.",
        "suggestion_diff": "@@ -16,2 +16,3 @@\n-        raise Exception(\"Invalid credentials\")\n+        logger.warning(f\"Failed login attempt for user: {username}\")\n+        raise AuthenticationError(\"Invalid username or password\")"
    }
}

async def analyze_code_via_api(diff_content: str) -> dict:
    """
    Calls OpenAI Chat Completions API with JSON mode to request a structured review of the diff.
    """
    if not client:
        return None

    system_prompt = (
        "You are an expert principal software engineer performing an automated code review on a git diff.\n"
        "Analyze the diff and return a valid JSON object matching this schema:\n"
        "{\n"
        "  \"overall_summary\": \"A high-level summary of the files changed, highlighting any issues found.\",\n"
        "  \"security_score\": 0-100,\n"
        "  \"performance_score\": 0-100,\n"
        "  \"best_practice_score\": 0-100,\n"
        "  \"issues\": [\n"
        "    {\n"
        "      \"filename\": \"name of the file containing the issue\",\n"
        "      \"line_number\": 12,\n"
        "      \"severity\": \"critical\" | \"high\" | \"medium\" | \"low\",\n"
        "      \"category\": \"security\" | \"performance\" | \"maintainability\" | \"best_practices\" | \"bug_risk\",\n"
        "      \"title\": \"Short, descriptive title of the issue\",\n"
        "      \"description\": \"Detailed explanation of why it is an issue and how to resolve it.\",\n"
        "      \"suggestion_diff\": \"A unified diff representation (+ and - lines) suggesting how to replace the lines around this issue to fix it.\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Be technical, clear, and extremely accurate."
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Review this PR git diff:\n\n{diff_content}"}
            ],
            temperature=0.1,
            timeout=45
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "429" in error_msg:
            global openai_active
            openai_active = False
        return None

def analyze_code_via_heuristics(files: list) -> dict:
    """
    Fallback regex scanner for offline mode. Audits files for basic patterns.
    """
    issues = []
    sec_score = 100
    perf_score = 100
    best_score = 100
    matched_categories = set()

    for file in files:
        if not file.content:
            continue
        
        lines = file.content.split("\n")
        for i, line in enumerate(lines, 1):
            # 1. SQL Injection check
            if re.search(r"f\"SELECT.*\{.*\}\"", line, re.IGNORECASE) or re.search(r"\"SELECT.*\" \+ ", line, re.IGNORECASE):
                issue = HEURISTIC_TEMPLATES["sql_injection"].copy()
                issue["filename"] = file.filename
                issue["line_number"] = i
                issues.append(issue)
                sec_score = max(30, sec_score - 35)
                matched_categories.add("security")

            # 2. Hardcoded secret check
            elif ("SECRET" in line.upper() or "JWT_KEY" in line.upper() or "API_KEY" in line.upper()) and "=" in line and ("\"" in line or "'" in line):
                if not any(env in line for env in ["getenv", "environ", "os.env"]):
                    issue = HEURISTIC_TEMPLATES["hardcoded_secret"].copy()
                    issue["filename"] = file.filename
                    issue["line_number"] = i
                    issues.append(issue)
                    sec_score = max(30, sec_score - 25)
                    matched_categories.add("security")

            # 3. Nested loop check
            elif "for " in line:
                # Check next 4 lines for nested loop
                for offset in range(1, 5):
                    if i + offset - 1 < len(lines):
                        next_line = lines[i + offset - 1]
                        if "for " in next_line and (len(next_line) - len(next_line.lstrip())) > (len(line) - len(line.lstrip())):
                            # Nested loop matched
                            issue = HEURISTIC_TEMPLATES["quadratic_loop"].copy()
                            issue["filename"] = file.filename
                            issue["line_number"] = i + offset
                            issues.append(issue)
                            perf_score = max(40, perf_score - 30)
                            matched_categories.add("performance")
                            break

            # 4. Broad Exception check
            elif "raise Exception(" in line or "except Exception:" in line:
                issue = HEURISTIC_TEMPLATES["broad_exception"].copy()
                issue["filename"] = file.filename
                issue["line_number"] = i
                issues.append(issue)
                best_score = max(50, best_score - 15)
                matched_categories.add("bug_risk")

    summary_text = "The Pull Request was audited."
    if matched_categories:
        summary_text = f"Audit flagged issues in: {', '.join(matched_categories)}. Suggestions have been provided inline."
        if "security" in matched_categories:
            summary_text += " Critical security flaws require immediate attention."
    else:
        summary_text += " No obvious issues or vulnerabilities were found."

    return {
        "overall_summary": summary_text,
        "security_score": sec_score,
        "performance_score": perf_score,
        "best_practice_score": best_score,
        "issues": issues
    }

async def run_actual_review_engine(db: Session, pr_id: int):
    """
    Executes the review process for a PR: combines patches, runs AI audit or fallback, and writes results to the database.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        return

    # Gather patches
    files = db.query(PRFile).filter(PRFile.pull_request_id == pr_id).all()
    diff_blocks = []
    for file in files:
        if file.patch_diff:
            diff_blocks.append(f"--- a/{file.filename}\n+++ b/{file.filename}\n{file.patch_diff}")

    combined_diff = "\n\n".join(diff_blocks)
    
    api_result = None
    if client and combined_diff.strip():
        api_result = await analyze_code_via_api(combined_diff)

    if not api_result:
        # Fallback to local heuristics
        api_result = analyze_code_via_heuristics(files)

    # Save results to DB
    # Clear old results
    db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_id).delete()
    db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_id).delete()

    for issue_data in api_result.get("issues", []):
        issue = AIReviewIssue(
            pull_request_id=pr_id,
            filename=issue_data.get("filename"),
            line_number=issue_data.get("line_number", 1),
            severity=issue_data.get("severity", "medium"),
            category=issue_data.get("category", "maintainability"),
            title=issue_data.get("title", "Review Finding"),
            description=issue_data.get("description", ""),
            suggestion_diff=issue_data.get("suggestion_diff")
        )
        db.add(issue)

    summary = ReviewSummary(
        pull_request_id=pr_id,
        overall_summary=api_result.get("overall_summary", "Review complete."),
        security_score=api_result.get("security_score", 100),
        performance_score=api_result.get("performance_score", 100),
        best_practice_score=api_result.get("best_practice_score", 100)
    )
    db.add(summary)
    
    pr.status = "completed"
    db.commit()

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
    Saves simulated results in the database.
    """
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        return {}
        
    # Clear any previous findings
    db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr_id).delete()
    db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr_id).delete()
    
    # Insert simulated issues
    simulated_issues = [
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

    for issue_data in simulated_issues:
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
        "issues": simulated_issues
    }

