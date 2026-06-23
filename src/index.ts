import { config, validateConfig } from './core/config/env';
import { fetchTodayCommits } from './features/github/fetchCommits';
import { generateReport } from './features/ai/generator';
import { sendTelegramMessage } from './features/notifier/telegram';
import { sendGitHubIssueNotification } from './features/notifier/github';
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
    
    const result = await generateReport(
      commits,
      config.ai.provider,
      config.ai.apiKey,
      config.ai.model,
      developerName
    );

    const report = result.report;

    if (report.includes('⚠️ Error:')) {
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
      
      // Secondary Telemetry Message
      console.log('Sending technical telemetry to Telegram...');
      let telemetryMsg = `🛠️ 𝗧𝗲𝗰𝗵𝗻𝗶𝗰𝗮𝗹 𝗧𝗲𝗹𝗲𝗺𝗲𝘁𝗿𝘆 𝗥𝗲𝗽𝗼𝗿𝘁\n\n`;
      telemetryMsg += `⏱️ 𝗘𝘅𝗲𝗰𝘂𝘁𝗶𝗼𝗻 𝗙𝗹𝗼𝘄:\n`;
      telemetryMsg += `1️⃣ Search & Events API Retrieval\n`;
      telemetryMsg += `2️⃣ Direct Repository & Branch Fallback Scan\n`;
      telemetryMsg += `3️⃣ Code Diff Extraction & Token Optimization\n`;
      telemetryMsg += `4️⃣ AI Synthesis via ${config.ai.provider}\n\n`;
      
      const totalFiles = commits.reduce((sum, c) => sum + (c.stats?.files || 0), 0);
      telemetryMsg += `📊 𝗗𝗮𝘁𝗮 𝗦𝘁𝗮𝘁𝘀:\n`;
      telemetryMsg += `• Total Commits Found: ${commits.length}\n`;
      telemetryMsg += `• Total Files Processed: ${totalFiles}\n`;
      telemetryMsg += `• Filtered/Missed: .lock files, images, and build folders (Ignored to save tokens)\n\n`;

      telemetryMsg += `🤖 𝗔𝗜 𝗧𝗼𝗸𝗲𝗻 𝗨𝘀𝗮𝗴𝗲 (${config.ai.model}):\n`;
      telemetryMsg += `• Raw Prompt String: ~${result.promptSize} characters\n`;
      
      if (result.telemetry) {
        telemetryMsg += `• Prompt Tokens: ${result.telemetry.promptTokens || 'N/A'}\n`;
        telemetryMsg += `• Completion Tokens: ${result.telemetry.completionTokens || 'N/A'}\n`;
        telemetryMsg += `• Total Tokens Consumed: ${result.telemetry.totalTokens || 'N/A'}\n`;
      } else {
        telemetryMsg += `• Token metrics not provided by this AI Provider.\n`;
      }
      
      await sendTelegramMessage(config.telegram.botToken, config.telegram.chatId, telemetryMsg);
    }
    
    // 5. GitHub Notifications (Issue Creation)
    // Uses the runner's default GITHUB_REPOSITORY env var to know where to create the issue
    if (process.env.GITHUB_REPOSITORY && config.github.token) {
      console.log(`Sending report to GitHub Issues (${process.env.GITHUB_REPOSITORY})...`);
      await sendGitHubIssueNotification(
        config.github.token,
        process.env.GITHUB_REPOSITORY,
        config.github.username,
        report
      );
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
