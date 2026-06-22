export interface GithubCommit {
  repoName: string;
  message: string;
  date: string;
  authorName?: string;
  codeDiff?: string;
}

export interface FormattedReport {
  date: string;
  developer: string;
  content: string;
}
