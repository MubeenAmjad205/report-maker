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
    return `**Date:** ${getTodayDateString()}\n**Developer:** ${developerName}\n\n**No potential tasks completed today.**`;
  }

  const dataStr = commits
    .map((c) => `Repo: ${c.repoName}\nMessage: ${c.message}\nCode Diff:\n${c.codeDiff}\n---`)
    .join('\n');

  const prompt = REPORT_GENERATION_PROMPT
    .replace('{DATE}', getTodayDateString())
    .replace('{DEVELOPER_NAME}', developerName)
    .replace('{DATA}', dataStr);

  const providerFn = getAIProvider(providerName);
  
  let retries = 3;
  let delay = 2000;

  while (retries > 0) {
    try {
      const result = await providerFn(prompt, apiKey, model);
      return result;
    } catch (error: any) {
      retries -= 1;
      const status = error.response?.status;
      
      console.error(`AI Provider Error (${providerName} - ${status || 'Unknown Status'}). Retries left: ${retries}`);
      
      if (retries === 0) {
        const errorData = error.response?.data || error.message;
        console.error('Max retries reached. AI Generation failed.', errorData);
        return `**Date:** ${getTodayDateString()}\n**Developer:** ${developerName}\n\n⚠️ **Error:** The report could not be generated due to an AI Provider Error (Status: ${status}). Please check your API limits or billing.\n\n\`\`\`json\n${JSON.stringify(errorData, null, 2)}\n\`\`\``;
      }

      // If it's a 4xx error (other than 429), it's likely an auth/bad request issue that won't resolve with retries
      if (status >= 400 && status < 500 && status !== 429) {
          const errorData = error.response?.data || error.message;
          console.error(`Fatal client error with provider ${providerName}. Skipping retries.`, errorData);
          return `**Date:** ${getTodayDateString()}\n**Developer:** ${developerName}\n\n⚠️ **Error:** Fatal AI Provider Error (Status: ${status}) using provider ${providerName}. Check your API Key and Model configuration.\n\n\`\`\`json\n${JSON.stringify(errorData, null, 2)}\n\`\`\``;
      }

      console.log(`Waiting ${delay}ms before retrying...`);
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }
  }

  return 'Error generating report.';
};
