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
      console.log('No commits today. Sending empty report template.');
    }

    // 3. Process Data (AI Generation)
    console.log(`Generating report using ${config.ai.provider}...`);
    
    const developerName = commits[0]?.authorName || config.github.username;
    
    const report = await generateReport(
      commits,
      config.ai.provider,
      config.ai.apiKey,
      config.ai.model,
      developerName
    );

    if (report.includes('⚠️ **Error:**')) {
      console.log('Report generation failed. Sending error notification.');
    } else {
      console.log('Report generated successfully.');
    }

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
  } catch (error: any) {
    console.error('Report Maker encountered an error:', error);
    
    // Attempt to notify of global failure if config allows
    try {
      const errorMsg = `⚠️ **CRITICAL FAILURE:** Report Maker encountered an unexpected error.\n\n\`\`\`json\n${JSON.stringify(error.message || error, null, 2)}\n\`\`\``;
      
      if (config.msteams?.webhookUrl) {
        const { sendMSTeamsMessage } = await import('./features/notifier/msteams');
        await sendMSTeamsMessage(config.msteams.webhookUrl, errorMsg);
      }
      if (config.telegram?.botToken && config.telegram?.chatId) {
        await sendTelegramMessage(config.telegram.botToken, config.telegram.chatId, errorMsg);
      }
    } catch (deliveryError) {
      console.error('Failed to send error notification:', deliveryError);
    }
    
    process.exit(1);
  }
};

main();
