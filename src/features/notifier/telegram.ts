import axios from 'axios';
import { FEATURE_FLAGS } from '../../shared/constants/flags';

// Telegram rejects any sendMessage whose text exceeds 4096 UTF-16 code units
// (JS string length uses the same units). We chunk below that limit with a safety
// margin, since the report is emoji-heavy and each emoji counts as 2 units.
const SAFE_CHUNK_LEN = 3900;

/**
 * Splits a message into chunks no longer than `maxLen`, preferring to break on
 * blank-line (paragraph) boundaries so each chunk reads as a natural continuation.
 * Oversized single blocks are hard-split on line boundaries as a fallback, taking
 * care never to cut in the middle of a surrogate pair (which would corrupt an emoji).
 */
export const splitTelegramMessage = (message: string, maxLen = SAFE_CHUNK_LEN): string[] => {
  if (message.length <= maxLen) return [message];

  const safeCut = (text: string, limit: number): number => {
    let cut = text.lastIndexOf('\n', limit);
    if (cut <= 0) cut = limit;
    // Don't split a surrogate pair (e.g. an emoji) — back up one unit if needed.
    const code = text.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
    return Math.max(1, cut);
  };

  const chunks: string[] = [];
  let current = '';

  for (const block of message.split('\n\n')) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (block.length <= maxLen) {
      current = block;
    } else {
      let rest = block;
      while (rest.length > maxLen) {
        const cut = safeCut(rest, maxLen);
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\n+/, '');
      }
      current = rest;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  message: string
): Promise<void> => {
  if (FEATURE_FLAGS.ENABLE_DRY_RUN || !FEATURE_FLAGS.ENABLE_TELEGRAM_NOTIFICATIONS) {
    console.log('[DRY RUN] Telegram Notification Skipped.');
    console.log(message);
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const chunks = splitTelegramMessage(message);

  try {
    for (let i = 0; i < chunks.length; i++) {
      await axios.post(url, {
        chat_id: chatId,
        text: chunks[i],
      });
    }
    console.log(
      `Successfully sent message to Telegram${chunks.length > 1 ? ` (in ${chunks.length} parts)` : ''}.`
    );
  } catch (error: any) {
    console.error('Error sending message to Telegram:', error.response?.data || error.message);
    throw error;
  }
};
