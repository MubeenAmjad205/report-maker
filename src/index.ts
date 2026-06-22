import { config, validateConfig } from './core/config/env';
import { fetchTodayCommits } from './features/github/fetchCommits';
import { generateReport } from './features/ai/generator';
import { sendTelegramMessage } from './features/notifier/telegram';
import { getSinceISOString } from './shared/utils/date.utils';

const main = async () => {
  try {
    console.log('Starting Report Maker...');
    
    // 1. Validate Environment Config
    validateConfig();

    // 2. Extract Data
    console.log(`Fetching commits since ${getSinceISOString()}...`);
    const commits = await fetchTodayCommits(
      config.github.token,
      config.github.username,
      getSinceISOString()
    );

    console.log(`Found ${commits.length} commits.`);

    if (commits.length === 0) {
      console.log('No commits today. Exiting without sending report.');
      return;
    }

    // 3. Process Data (AI Generation)
    console.log(`Generating report using ${config.ai.provider}...`);
    const report = await generateReport(
      commits,
      config.ai.provider,
      config.ai.apiKey,
      config.github.username
    );

    console.log('Report generated successfully.');

    // 4. Delivery
    if (config.msteams.webhookUrl) {
      console.log('Sending report to MS Teams...');
      const { sendMSTeamsMessage } = await import('./features/notifier/msteams');
      await sendMSTeamsMessage(config.msteams.webhookUrl, report);
    }
    
    if (config.telegram.botToken && config.telegram.chatId) {
      console.log('Sending report to Telegram...');
      await sendTelegramMessage(config.telegram.botToken, config.telegram.chatId, report);
    }

    console.log('Report Maker completed successfully.');
  } catch (error) {
    console.error('Report Maker encountered an error:', error);
    process.exit(1);
  }
};

main();
