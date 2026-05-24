import sys
import os

# Set path to allow relative package imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import init_db, SessionLocal, Repository, PullRequest, PRFile, AIReviewIssue, ReviewSummary
from backend.ai_engine import generate_simulated_review, trigger_analysis

def run_test():
    print("Initializing test database...")
    init_db()
    
    db = SessionLocal()
    try:
        # 1. Clean previous data
        db.query(AIReviewIssue).delete()
        db.query(ReviewSummary).delete()
        db.query(PRFile).delete()
        db.query(PullRequest).delete()
        db.query(Repository).delete()
        db.commit()
        print("[OK] Previous test data cleared.")

        # 2. Create Repository
        repo = Repository(
            name="auth-service",
            owner="codepilot-ai",
            description="Core authentication and token validation microservice."
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        print(f"[OK] Created Repository: {repo.owner}/{repo.name}")

        # 3. Create Pull Request
        pr = PullRequest(
            repository_id=repo.id,
            number=42,
            title="feat: add jwt auth and permission checks",
            source_branch="feat/jwt-auth",
            target_branch="main",
            author="alex-dev",
            status="pending"
        )
        db.add(pr)
        db.commit()
        db.refresh(pr)
        print(f"[OK] Created PR #{pr.number} (Status: {pr.status})")

        # 4. Create Files
        file1 = PRFile(
            pull_request_id=pr.id,
            filename="auth.py",
            status="modified",
            additions=11,
            deletions=2,
            content="test"
        )
        db.add(file1)
        db.commit()
        print(f"[OK] Created PR File: {file1.filename}")

        # 5. Trigger Analysis (Updates status to analyzing)
        trigger_analysis(db, pr.id)
        db.refresh(pr)
        print(f"[OK] Triggered analysis. PR status: {pr.status}")

        # 6. Run AI engine simulation
        result = generate_simulated_review(db, pr.id)
        db.refresh(pr)
        print(f"[OK] Completed analysis. PR status: {pr.status}")
        
        # Verify DB output
        issues = db.query(AIReviewIssue).filter(AIReviewIssue.pull_request_id == pr.id).all()
        summary = db.query(ReviewSummary).filter(ReviewSummary.pull_request_id == pr.id).first()
        
        print("\n--- RESULTS VERIFICATION ---")
        print(f"Overall Summary: {summary.overall_summary}")
        print(f"Scores -> Security: {summary.security_score} | Performance: {summary.performance_score} | Quality: {summary.best_practice_score}")
        print(f"Issues detected: {len(issues)}")
        for idx, issue in enumerate(issues):
            print(f"  [{idx+1}] [{issue.severity.upper()}] {issue.filename}:{issue.line_number} - {issue.title}")
        
        assert len(issues) == 4, "Should generate 4 simulated review findings."
        assert summary.security_score == 38, "Security score should be 38."
        print("\n[SUCCESS] Backend verification test completed successfully!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
