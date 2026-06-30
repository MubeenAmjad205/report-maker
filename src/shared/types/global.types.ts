export interface GithubCommit {
  repoName: string;
  message: string;
  date: string;
  authorName?: string;
  codeDiff?: string;
  commitUrl?: string; // Human-readable html_url to the commit on GitHub
  stats?: {
    files: number;
    additions: number;
    deletions: number;
  };
  fileTypes?: Record<string, number>; // e.g. { ".ts": 3, ".css": 1 }
}

export type PullRequestStatus = 'opened' | 'merged' | 'closed';

export interface GithubPullRequest {
  repoName: string;
  number: number;
  title: string;
  url: string; // html_url
  author: string;
  status: PullRequestStatus; // opened today / merged today / closed-unmerged today
}

export type WorkflowRunConclusion = 'success' | 'failure' | 'other';

export interface GithubWorkflowRun {
  repoName: string;
  name: string; // workflow name
  conclusion: WorkflowRunConclusion; // bucketed from the GitHub conclusion field
  rawConclusion: string; // original value (success/failure/cancelled/skipped/null...)
  url: string; // html_url to the run
  branch: string;
  runNumber: number;
}

export interface FormattedReport {
  date: string;
  developer: string;
  content: string;
}
