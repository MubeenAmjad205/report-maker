export interface GithubCommit {
  repoName: string;
  message: string;
  date: string;
  authorName?: string;
  codeDiff?: string;
  stats?: {
    files: number;
    additions: number;
    deletions: number;
  };
}

export interface FormattedReport {
  date: string;
  developer: string;
  content: string;
}
