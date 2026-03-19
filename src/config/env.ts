import { z } from 'zod';

const envSchema = z.object({
  // MongoDB
  MONGO_DB_URI: z.string().min(1),

  // Avail (Type A)
  AVAIL_RPC_URL: z.string().url(),
  AVAIL_WALLET_ADDRESS: z.string().min(1),

  // Stacks (Type B)
  STACKS_API_URL: z.string().url(),
  STACKS_WALLET_ADDRESS: z.string().min(1),

  // Story (Type B)
  STORY_RPC_URL: z.string().url(),
  STORY_WALLET_ADDRESS: z.string().min(1),
  STORY_VALIDATOR_ADDRESS: z.string().min(1),

  // Bera (Type C)
  BERA_RPC_URL: z.string().url(),
  BERA_WALLET_ADDRESS: z.string().min(1),
  BERA_BGT_VAULT_ADDRESS: z.string().min(1),

  // Infrared (Type C)
  INFRARED_RPC_URL: z.string().url(),
  INFRARED_WALLET_ADDRESS: z.string().min(1),
  INFRARED_TOKEN_ADDRESS: z.string().min(1),

  // Hyperliquid (Type B)
  HYPERLIQUID_API_URL: z.string().url(),
  HYPERLIQUID_WALLET_ADDRESS: z.string().min(1),

  // Monad (Type C)
  MONAD_RPC_URL: z.string().url(),
  MONAD_WALLET_ADDRESS: z.string().min(1),
  MONAD_TOKEN_ADDRESS: z.string().min(1),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;
export const env: Env = envSchema.parse(process.env);
