import { GithubCommit } from '../../shared/types/global.types';
import { REPORT_GENERATION_PROMPT } from '../../shared/constants/prompts';
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

export const generateReport = async (
  commits: GithubCommit[],
  providerName: string,
  apiKey: string,
  model: string,
  developerName: string
): Promise<ReportGenerationResult> => {
  if (commits.length === 0) {
    return {
      report: `📅 Date: ${getTodayDateString()}\n\n👤 Developer: ${developerName}\n\n🏖️ Status: No development activity tracked today.`,
      promptSize: 0
    };
  }

  const repos = new Map<string, { commits: GithubCommit[], stats: { files: number, additions: number, deletions: number } }>();
  
  for (const c of commits) {
    if (!repos.has(c.repoName)) {
      repos.set(c.repoName, { commits: [], stats: { files: 0, additions: 0, deletions: 0 } });
    }
    const repo = repos.get(c.repoName)!;
    repo.commits.push(c);
    if (c.stats) {
       repo.stats.files += c.stats.files;
       repo.stats.additions += c.stats.additions;
       repo.stats.deletions += c.stats.deletions;
    }
  }

  let dataStr = '';
  for (const [repoName, repoData] of repos.entries()) {
    dataStr += `\n[REPOSITORY: ${repoName}]\n`;
    dataStr += `AGGREGATE STATS: ${repoData.commits.length} Commits, ${repoData.stats.files} Files Changed, +${repoData.stats.additions} Additions, -${repoData.stats.deletions} Deletions\n\n`;
    for (const c of repoData.commits) {
      dataStr += `Commit Message: ${c.message}\nCode Diff:\n${c.codeDiff}\n---\n`;
    }
  }

  const prompt = REPORT_GENERATION_PROMPT
    .replace('{DATE}', getTodayDateString())
    .replace('{DEVELOPER_NAME}', developerName)
    .replace('{DATA}', dataStr);

  console.log(`[Token Optimization] Prompt constructed. Approximate character count: ${prompt.length}`);

  const providerFn = getAIProvider(providerName);
  
  let retries = 3;
  let delay = 2000;

  while (retries > 0) {
    try {
      const result = await providerFn(prompt, apiKey, model);
      return {
        report: result.text,
        telemetry: result.usage,
        promptSize: prompt.length
      };
    } catch (error: any) {
      retries -= 1;
      const status = error.response?.status;
      
      console.error(`AI Provider Error (${providerName} - ${status || 'Unknown Status'}). Retries left: ${retries}`);
      
      if (retries === 0) {
        const errorData = error.response?.data || error.message;
        console.error('Max retries reached. AI Generation failed.', errorData);
        return {
          report: `📅 Date: ${getTodayDateString()}\n\n👤 Developer: ${developerName}\n\n⚠️ Error: The report could not be generated due to an AI Provider Error (Status: ${status}). Please check your API limits or billing.\n\n\`\`\`json\n${JSON.stringify(errorData, null, 2)}\n\`\`\``,
          promptSize: prompt.length
        };
      }

      // If it's a 4xx error (other than 429), it's likely an auth/bad request issue that won't resolve with retries
      if (status >= 400 && status < 500 && status !== 429) {
          const errorData = error.response?.data || error.message;
          console.error(`Fatal client error with provider ${providerName}. Skipping retries.`, errorData);
          return {
            report: `📅 Date: ${getTodayDateString()}\n\n👤 Developer: ${developerName}\n\n⚠️ Error: Fatal AI Provider Error (Status: ${status}) using provider ${providerName}. Check your API Key and Model configuration.\n\n\`\`\`json\n${JSON.stringify(errorData, null, 2)}\n\`\`\``,
            promptSize: prompt.length
          };
      }

      console.log(`Waiting ${delay}ms before retrying...`);
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }
  }

  return { report: 'Error generating report.', promptSize: prompt.length };
};
