import axios from 'axios';
import { GithubPullRequest } from '../../shared/types/global.types';
import { mapWithConcurrency, GITHUB_API_CONCURRENCY } from '../../shared/utils/concurrency.utils';

/**
 * Fetches all pull-request activity (any author) for the given repositories that occurred
 * since the provided timestamp. A PR is included if it was opened, merged, or closed
 * (without merge) today, and is tagged with the most significant of those statuses.
 *
 * Returns a Map keyed by repo full name (owner/repo) -> list of PRs. Repos with no
 * qualifying activity are omitted from the map.
 */
export const fetchTodayPullRequests = async (
  token: string,
  username: string,
  repoNames: string[],
  since: string
): Promise<Map<string, GithubPullRequest[]>> => {
  const result = new Map<string, GithubPullRequest[]>();
  const sinceDate = new Date(since);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  await mapWithConcurrency(repoNames, GITHUB_API_CONCURRENCY, async (repoName) => {
    try {
      const res = await axios.get(`https://api.github.com/repos/${repoName}/pulls`, {
        headers,
        // Sort by most recently updated so today's activity surfaces within the first page.
        params: { state: 'all', sort: 'updated', direction: 'desc', per_page: 50 },
      });

      const prs: GithubPullRequest[] = [];
      for (const pr of res.data || []) {
        if (pr.user?.login !== username) continue;

        // Priority: merged > closed(unmerged) > opened. A PR opened AND merged today is
        // reported once, as merged (the more meaningful outcome).
        let status: GithubPullRequest['status'] | null = null;
        if (pr.merged_at && new Date(pr.merged_at) >= sinceDate) {
          status = 'merged';
        } else if (pr.closed_at && !pr.merged_at && new Date(pr.closed_at) >= sinceDate) {
          status = 'closed';
        } else if (pr.created_at && new Date(pr.created_at) >= sinceDate) {
          status = 'opened';
        }

        if (status) {
          prs.push({
            repoName,
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user?.login || 'unknown',
            status,
          });
        }
      }

      if (prs.length > 0) {
        result.set(repoName, prs);
      }
    } catch (error: any) {
      console.warn(`PR fetch for ${repoName} encountered an error:`, error.response?.data || error.message);
    }
  });

  return result;
};
