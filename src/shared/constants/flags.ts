export const AI_PROVIDERS = {
  GEMINI: 'GEMINI',
  OPENAI: 'OPENAI',
  OPENROUTER: 'OPENROUTER',
} as const;

export const FEATURE_FLAGS = {
  ENABLE_TELEGRAM_NOTIFICATIONS: true,
  ENABLE_DRY_RUN: process.env.DRY_RUN === 'true',
  USE_MS_TEAMS_FORMATTING: true,
} as const;
