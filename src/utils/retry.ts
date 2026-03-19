import { logger } from '@/utils/logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < options.maxAttempts) {
        const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
        logger.warn({ attempt, delayMs }, 'withRetry: attempt failed, retrying');
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
