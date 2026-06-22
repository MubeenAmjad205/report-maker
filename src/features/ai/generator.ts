import { GithubCommit } from '../../shared/types/global.types';
import { REPORT_GENERATION_PROMPT } from '../../shared/constants/prompts';
import { getAIProvider } from './providers';
import { getTodayDateString } from '../../shared/utils/date.utils';

export const generateReport = async (
  commits: GithubCommit[],
  providerName: string,
  apiKey: string,
  model: string,
  developerName: string
): Promise<string> => {
  if (commits.length === 0) {
    return 'No commits found for today.';
  }

  const dataStr = commits
    .map((c) => `Repo: ${c.repoName} | Message: ${c.message}`)
    .join('\n');

  const prompt = REPORT_GENERATION_PROMPT
    .replace('{DATE}', getTodayDateString())
    .replace('{DEVELOPER_NAME}', developerName)
    .replace('{DATA}', dataStr);

  const providerFn = getAIProvider(providerName);
  
  try {
    const result = await providerFn(prompt, apiKey, model);
    return result;
  } catch (error) {
    console.error('Error generating report with AI:', error);
    throw error;
  }
};
