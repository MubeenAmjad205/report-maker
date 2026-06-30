import axios from 'axios';
import { GithubWorkflowRun, WorkflowRunConclusion } from '../../shared/types/global.types';
import { mapWithConcurrency, GITHUB_API_CONCURRENCY } from '../../shared/utils/concurrency.utils';

const bucketConclusion = (conclusion: string | null): WorkflowRunConclusion => {
  if (conclusion === 'success') return 'success';
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'startup_failure') {
    return 'failure';
  }
  // cancelled, skipped, neutral, action_required, stale, or null (still running)
  return 'other';
};

/**
 * Fetches GitHub Actions workflow runs created today for the given repositories.
 * The `created` filter ensures we only report runs that actually ran on the day
 * ("only which have changes in that day"). Returns a Map of repo full name -> runs.
 */
export const fetchTodayWorkflowRuns = async (
  token: string,
  repoNames: string[],
  since: string
): Promise<Map<string, GithubWorkflowRun[]>> => {
  const result = new Map<string, GithubWorkflowRun[]>();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
  // GitHub's `created` filter expects a date (or datetime); the ISO string works as `>=`.
  const createdFilter = `>=${since}`;

  await mapWithConcurrency(repoNames, GITHUB_API_CONCURRENCY, async (repoName) => {
    try {
      const res = await axios.get(`https://api.github.com/repos/${repoName}/actions/runs`, {
        headers,
        params: { created: createdFilter, per_page: 50 },
      });

      const runs: GithubWorkflowRun[] = (res.data?.workflow_runs || []).map((run: any) => ({
        repoName,
        name: run.name || run.display_title || 'Workflow',
        conclusion: bucketConclusion(run.conclusion),
        rawConclusion: run.conclusion || run.status || 'unknown',
        url: run.html_url,
        branch: run.head_branch || '',
        runNumber: run.run_number,
      }));

      if (runs.length > 0) {
        result.set(repoName, runs);
      }
    } catch (error: any) {
      // Actions may be disabled on a repo (404) or inaccessible — skip quietly.
      console.warn(`Workflow-run fetch for ${repoName} encountered an error:`, error.response?.data || error.message);
    }
  });

  return result;
};
