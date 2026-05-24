export interface Repository {
  id: number;
  name: string;
  owner: string;
  description?: string;
  created_at: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  author: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  source_branch: string;
  target_branch: string;
  repo_name: string;
  repo_owner: string;
  created_at: string;
}

export interface PRFile {
  id: number;
  filename: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  patch_diff?: string;
  content?: string;
}

export interface AIReviewIssue {
  id: number;
  filename: string;
  line_number: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'maintainability' | 'best_practices' | 'bug_risk';
  title: string;
  description: string;
  suggestion_diff?: string;
}

export interface ReviewSummary {
  overall_summary: string;
  security_score: number;
  performance_score: number;
  best_practice_score: number;
}

export interface PRDetailsResponse {
  pr: {
    id: number;
    number: number;
    title: string;
    author: string;
    status: 'pending' | 'analyzing' | 'completed' | 'failed';
    source_branch: string;
    target_branch: string;
    created_at: string;
  };
  repo: {
    id: number;
    name: string;
    owner: string;
    description?: string;
  } | null;
  summary: ReviewSummary | null;
  files: PRFile[];
  issues: AIReviewIssue[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
