import {
  GithubCommit,
  GithubPullRequest,
  GithubWorkflowRun,
} from '../../shared/types/global.types';
import { COMMIT_SUMMARY_PROMPT } from '../../shared/constants/prompts';
import { getAIProvider } from './providers';
import { getTodayDateString } from '../../shared/utils/date.utils';

export interface ReportGenerationResult {
  report: string;
  telemetry?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  promptSize: number;
}

interface RepoAggregate {
  commits: GithubCommit[];
  pullRequests: GithubPullRequest[];
  workflowRuns: GithubWorkflowRun[];
  stats: { files: number; additions: number; deletions: number };
  fileTypes: Record<string, number>;
}

const emptyAggregate = (): RepoAggregate => ({
  commits: [],
  pullRequests: [],
  workflowRuns: [],
  stats: { files: 0, additions: 0, deletions: 0 },
  fileTypes: {},
});

// ---------------------------------------------------------------------------
// Pure formatting helpers (deterministic — no AI involved)
// ---------------------------------------------------------------------------

/** "owner/report-maker" -> "Report Maker" */
const toProjectName = (repoName: string): string => {
  const short = repoName.includes('/') ? repoName.split('/').slice(1).join('/') : repoName;
  return short
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Renders a fixed-width Unicode bar, e.g. "████░░░░░░". */
const renderBar = (count: number, max: number, width = 12): string => {
  if (max <= 0 || count <= 0) return '░'.repeat(width);
  const filled = Math.max(1, Math.round((count / max) * width));
  const clamped = Math.min(filled, width);
  return '█'.repeat(clamped) + '░'.repeat(width - clamped);
};

const formatFileTypes = (fileTypes: Record<string, number>): string =>
  Object.entries(fileTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => `${count} ${ext}`)
    .join(', ');

const RUN_ICON: Record<GithubWorkflowRun['conclusion'], string> = {
  success: '✅',
  failure: '❌',
  other: '⚪',
};

const PR_ICON: Record<GithubPullRequest['status'], string> = {
  opened: '🟢',
  merged: '🟣',
  closed: '🔴',
};
const PR_LABEL: Record<GithubPullRequest['status'], string> = {
  opened: 'Opened',
  merged: 'Merged',
  closed: 'Closed (not merged)',
};

// Styled section dividers (Teams-safe Unicode box-drawing).
const OWNER_DIVIDER = '━'.repeat(28);
const REPO_DIVIDER = '┈'.repeat(24);

// Conventional-commit type -> badge, in display order.
const COMMIT_TYPE_META: Record<string, { emoji: string; label: string }> = {
  feat: { emoji: '✨', label: 'feat' },
  fix: { emoji: '🐛', label: 'fix' },
  refactor: { emoji: '♻️', label: 'refactor' },
  perf: { emoji: '⚡', label: 'perf' },
  docs: { emoji: '📝', label: 'docs' },
  test: { emoji: '🧪', label: 'test' },
  build: { emoji: '📦', label: 'build' },
  ci: { emoji: '⚙️', label: 'ci' },
  style: { emoji: '💅', label: 'style' },
  chore: { emoji: '🧹', label: 'chore' },
  revert: { emoji: '⏪', label: 'revert' },
  other: { emoji: '📌', label: 'other' },
};

const commitTypeKey = (message: string): string => {
  const first = message.split('\n')[0].trim().toLowerCase();
  const match = first.match(/^([a-z]+)(\([^)]*\))?!?:/);
  return match && COMMIT_TYPE_META[match[1]] ? match[1] : 'other';
};

/** "✨ 4 feat  •  🐛 2 fix  •  ♻️ 1 refactor" (empty string if no commits). */
const formatCommitTypes = (commits: GithubCommit[]): string => {
  const counts: Record<string, number> = {};
  for (const c of commits) {
    const key = commitTypeKey(c.message);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.keys(COMMIT_TYPE_META)
    .filter((k) => counts[k])
    .map((k) => `${COMMIT_TYPE_META[k].emoji} ${counts[k]} ${COMMIT_TYPE_META[k].label}`)
    .join('  •  ');
};

/** Proportional 🟩/🟥 bar of additions vs deletions. */
const codeBalanceBar = (additions: number, deletions: number, width = 10): string => {
  const total = additions + deletions;
  if (total === 0) return `${'⬜'.repeat(width)}  +0 / -0`;
  const green = Math.max(0, Math.min(width, Math.round((additions / total) * width)));
  const red = width - green;
  const pct = Math.round((additions / total) * 100);
  return `${'🟩'.repeat(green)}${'🟥'.repeat(red)}  +${additions} / -${deletions} (${pct}% added)`;
};

/** "⚙️ CI Health: 🟢🟢🔴  →  2/3 passed (67%)" */
const ciHealthLine = (runs: GithubWorkflowRun[]): string => {
  const dots = runs
    .map((r) => (r.conclusion === 'success' ? '🟢' : r.conclusion === 'failure' ? '🔴' : '⚪'))
    .join('');
  const success = runs.filter((r) => r.conclusion === 'success').length;
  const failure = runs.filter((r) => r.conclusion === 'failure').length;
  const completed = success + failure;
  const summary =
    completed > 0
      ? `${success}/${completed} passed (${Math.round((success / completed) * 100)}%)`
      : `${runs.length} run(s) in progress`;
  return `⚙️ CI Health: ${dots}  →  ${summary}`;
};

// ---------------------------------------------------------------------------
// AI step: turn commit data into per-repo summary bullets (the ONLY AI output)
// ---------------------------------------------------------------------------

const extractJsonObject = (text: string): Record<string, string[]> | null => {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

interface SummaryResult {
  summaries: Record<string, string[]>;
  telemetry?: ReportGenerationResult['telemetry'];
  promptSize: number;
}

/** Fallback bullets when the AI is unavailable: first line of each commit message. */
const fallbackSummaries = (repos: Map<string, RepoAggregate>): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [name, repo] of repos.entries()) {
    if (repo.commits.length === 0) continue;
    out[name] = repo.commits.map((c) => c.message.split('\n')[0].trim()).filter(Boolean);
  }
  return out;
};

const fetchSummaries = async (
  repos: Map<string, RepoAggregate>,
  providerName: string,
  apiKey: string,
  model: string
): Promise<SummaryResult> => {
  // Build the raw data only for repositories that actually have commits.
  let dataStr = '';
  let hasCommits = false;
  for (const [repoName, repo] of repos.entries()) {
    if (repo.commits.length === 0) continue;
    hasCommits = true;
    dataStr += `\n[REPOSITORY: ${repoName}]\n`;
    for (const c of repo.commits) {
      dataStr += `Commit Message: ${c.message}\nCode Diff:\n${c.codeDiff}\n---\n`;
    }
  }

  if (!hasCommits) {
    return { summaries: {}, promptSize: 0 };
  }

  const prompt = COMMIT_SUMMARY_PROMPT.replace('{DATA}', dataStr);
  console.log(`[Token Optimization] Summary prompt constructed. Approx characters: ${prompt.length}`);

  const providerFn = getAIProvider(providerName);
  let retries = 3;
  let delay = 2000;

  while (retries > 0) {
    try {
      const result = await providerFn(prompt, apiKey, model);
      const parsed = extractJsonObject(result.text);
      return {
        summaries: parsed || fallbackSummaries(repos),
        telemetry: result.usage,
        promptSize: prompt.length,
      };
    } catch (error: any) {
      retries -= 1;
      const status = error.response?.status;
      console.error(`AI Provider Error (${providerName} - ${status || 'Unknown'}). Retries left: ${retries}`);

      // Non-retryable client errors (bad key/model) — stop early and fall back.
      const fatalClient = status >= 400 && status < 500 && status !== 429;
      if (retries === 0 || fatalClient) {
        console.error('AI summary generation failed; falling back to commit messages.');
        return { summaries: fallbackSummaries(repos), promptSize: prompt.length };
      }

      console.log(`Waiting ${delay}ms before retrying...`);
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }

  return { summaries: fallbackSummaries(repos), promptSize: prompt.length };
};

// ---------------------------------------------------------------------------
// Main entry: aggregate -> get AI bullets -> assemble report deterministically
// ---------------------------------------------------------------------------

export const generateReport = async (
  commits: GithubCommit[],
  prsByRepo: Map<string, GithubPullRequest[]>,
  runsByRepo: Map<string, GithubWorkflowRun[]>,
  providerName: string,
  apiKey: string,
  model: string,
  developerName: string
): Promise<ReportGenerationResult> => {
  if (commits.length === 0 && prsByRepo.size === 0 && runsByRepo.size === 0) {
    return {
      report: `📅 Date: ${getTodayDateString()}\n\n👤 Developer: ${developerName}\n\n🏖️ Status: No development activity tracked today.`,
      promptSize: 0,
    };
  }

  // 1. Aggregate per repository.
  const repos = new Map<string, RepoAggregate>();
  const ensureRepo = (name: string): RepoAggregate => {
    if (!repos.has(name)) repos.set(name, emptyAggregate());
    return repos.get(name)!;
  };

  for (const c of commits) {
    const repo = ensureRepo(c.repoName);
    repo.commits.push(c);
    if (c.stats) {
      repo.stats.files += c.stats.files;
      repo.stats.additions += c.stats.additions;
      repo.stats.deletions += c.stats.deletions;
    }
    if (c.fileTypes) {
      for (const [ext, count] of Object.entries(c.fileTypes)) {
        repo.fileTypes[ext] = (repo.fileTypes[ext] || 0) + count;
      }
    }
  }
  for (const [repoName, prs] of prsByRepo.entries()) ensureRepo(repoName).pullRequests = prs;
  for (const [repoName, runs] of runsByRepo.entries()) ensureRepo(repoName).workflowRuns = runs;

  // 2. Get AI summary bullets (the only AI-produced content).
  const { summaries, telemetry, promptSize } = await fetchSummaries(repos, providerName, apiKey, model);

  // 3. Group repositories by owner.
  const owners = new Map<string, string[]>();
  for (const repoName of repos.keys()) {
    const owner = repoName.includes('/') ? repoName.split('/')[0] : 'unknown';
    if (!owners.has(owner)) owners.set(owner, []);
    owners.get(owner)!.push(repoName);
  }

  // 4. Grand totals (top-of-report header).
  let gRepos = 0;
  let gCommits = 0;
  let gPRs = 0;
  let gMergedPRs = 0;
  let gRuns = 0;
  let gCiFailures = 0;
  let gAdds = 0;
  let gDels = 0;
  for (const repo of repos.values()) {
    gRepos += 1;
    gCommits += repo.commits.length;
    gPRs += repo.pullRequests.length;
    gMergedPRs += repo.pullRequests.filter((p) => p.status === 'merged').length;
    gRuns += repo.workflowRuns.length;
    gCiFailures += repo.workflowRuns.filter((r) => r.conclusion === 'failure').length;
    gAdds += repo.stats.additions;
    gDels += repo.stats.deletions;
  }
  const net = gAdds - gDels;
  const netStr = `${net >= 0 ? '+' : ''}${net}`;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // 5. Assemble the report.
  const lines: string[] = [];
  lines.push(`📅 Date: ${getTodayDateString()}`);
  lines.push(`👤 Developer: ${developerName}`);

  // Headline: one glanceable summary line.
  const headline: string[] = [plural(gCommits, 'commit'), plural(gRepos, 'project')];
  if (gMergedPRs > 0) headline.push(`${plural(gMergedPRs, 'PR')} merged`);
  if (gRuns > 0) headline.push(gCiFailures === 0 ? 'all CI green ✅' : `${plural(gCiFailures, 'CI fail')} ❌`);
  lines.push(`⚡ Today: ${headline.join(' • ')}`);

  lines.push(
    `📊 Daily Totals: ${gRepos} Repos • ${gCommits} Commits • ${gPRs} PRs • ${gRuns} CI Runs`
  );
  lines.push(`🧮 Net Code: +${gAdds} / -${gDels} (net ${netStr}) • Churn ${gAdds + gDels} lines`);
  lines.push(`⚖️ Code Balance: ${codeBalanceBar(gAdds, gDels)}`);
  const grandTypes = formatCommitTypes(commits);
  if (grandTypes) lines.push(`🏷️ Types: ${grandTypes}`);

  for (const [owner, ownerRepos] of owners.entries()) {
    let oCommits = 0;
    let oPRs = 0;
    let oAdds = 0;
    let oDels = 0;
    for (const repoName of ownerRepos) {
      const r = repos.get(repoName)!;
      oCommits += r.commits.length;
      oPRs += r.pullRequests.length;
      oAdds += r.stats.additions;
      oDels += r.stats.deletions;
    }
    const oNet = oAdds - oDels;

    lines.push(OWNER_DIVIDER);
    lines.push(`🏢 Owner: ${owner}`);
    lines.push(
      `📊 Summary: ${ownerRepos.length} Repos • ${oCommits} Commits • ${oPRs} PRs • +${oAdds} / -${oDels} (net ${oNet >= 0 ? '+' : ''}${oNet})`
    );

    // Commits-per-repo bar chart for this owner.
    const maxCommits = Math.max(...ownerRepos.map((rn) => repos.get(rn)!.commits.length), 0);
    if (maxCommits > 0) {
      lines.push('📈 Commits by Project:');
      for (const repoName of ownerRepos) {
        const r = repos.get(repoName)!;
        lines.push(`${toProjectName(repoName)}  ${renderBar(r.commits.length, maxCommits)} ${r.commits.length}`);
      }
    }

    for (const repoName of ownerRepos) {
      const r = repos.get(repoName)!;
      lines.push(REPO_DIVIDER);
      lines.push(`🚀 Project: ${toProjectName(repoName)} (${r.commits.length} Commits)`);
      lines.push(`🔗 Repo: https://github.com/${repoName}`);
      lines.push(
        `📈 Stats: ${r.stats.files} Files Changed • +${r.stats.additions} / -${r.stats.deletions}`
      );
      const ft = formatFileTypes(r.fileTypes);
      if (ft) lines.push(`🧩 File Types: ${ft}`);
      const repoTypes = formatCommitTypes(r.commits);
      if (repoTypes) lines.push(`🏷️ Types: ${repoTypes}`);
      if (r.stats.additions + r.stats.deletions > 0) {
        lines.push(`⚖️ Balance: ${codeBalanceBar(r.stats.additions, r.stats.deletions)}`);
      }

      // CI / Actions runs (today only) — health summary then each run.
      if (r.workflowRuns.length > 0) {
        lines.push(ciHealthLine(r.workflowRuns));
        for (const run of r.workflowRuns) {
          const branch = run.branch ? ` [${run.branch}]` : '';
          lines.push(`• ${RUN_ICON[run.conclusion]} ${run.name} #${run.runNumber}${branch} — ${run.rawConclusion}`);
          lines.push(`${run.url}`);
        }
      }

      // Pull requests grouped by status.
      const statuses: GithubPullRequest['status'][] = ['opened', 'merged', 'closed'];
      const anyPRs = r.pullRequests.length > 0;
      if (anyPRs) {
        lines.push('🔀 Pull Requests:');
        for (const status of statuses) {
          for (const pr of r.pullRequests.filter((p) => p.status === status)) {
            lines.push(`• ${PR_ICON[status]} ${PR_LABEL[status]} — #${pr.number} ${pr.title} (by ${pr.author})`);
            lines.push(`${pr.url}`);
          }
        }
      }

      // Completed work (AI bullets) or a WIP note when there were no commits.
      const bullets = summaries[repoName] || [];
      if (bullets.length > 0) {
        lines.push('✅ Completed:');
        for (const b of bullets) {
          lines.push(`• ${b}`);
          const commit = r.commits.find((c) => c.message.split('\n')[0].trim() === b.trim());
          if (commit?.commitUrl) lines.push(`${commit.commitUrl}`);
        }
        // Always provide commit links even when bullets are AI-consolidated (not 1:1).
        if (r.commits.length > 0 && !r.commits.some((c) => bullets.includes(c.message.split('\n')[0].trim()))) {
          lines.push('🔗 Commits:');
          for (const c of r.commits) {
            if (c.commitUrl) lines.push(`${c.commitUrl}`);
          }
        }
      } else if (r.commits.length === 0) {
        lines.push('🚧 No commits today — listed for its pull-request / CI activity.');
      }
    }
  }

  // Join with blank lines between blocks so MS Teams preserves spacing.
  const report = lines.join('\n\n');

  return { report, telemetry, promptSize };
};
