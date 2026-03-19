import { describe, it, expect, beforeEach, vi } from 'vitest';

const VALID_ENV = {
  MONGO_DB_URI: 'mongodb://localhost:27017/validator_rewards',
  AVAIL_RPC_URL: 'wss://avail-rpc.example.com',
  AVAIL_WALLET_ADDRESS: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  STACKS_API_URL: 'https://stacks-api.example.com',
  STACKS_WALLET_ADDRESS: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
  STORY_RPC_URL: 'https://story-rpc.example.com',
  STORY_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
  STORY_VALIDATOR_ADDRESS: '0x1234567890123456789012345678901234567890',
  BERA_RPC_URL: 'https://bera-rpc.example.com',
  BERA_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
  BERA_BGT_VAULT_ADDRESS: '0x1234567890123456789012345678901234567890',
  INFRARED_RPC_URL: 'https://infrared-rpc.example.com',
  INFRARED_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
  INFRARED_TOKEN_ADDRESS: '0x1234567890123456789012345678901234567890',
  HYPERLIQUID_API_URL: 'https://hl-api.example.com',
  HYPERLIQUID_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
  MONAD_RPC_URL: 'https://monad-rpc.example.com',
  MONAD_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
  MONAD_TOKEN_ADDRESS: '0x1234567890123456789012345678901234567890',
};

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
    // 기존 환경 변수 정리
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
    delete process.env.LOG_LEVEL;
  });

  it('유효한 환경 변수 세트로 정상 파싱', async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import('@/config/env');
    expect(env.MONGO_DB_URI).toBe(VALID_ENV.MONGO_DB_URI);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('필수 변수 누락 시 ZodError throw', async () => {
    const { MONGO_DB_URI: _, ...withoutMongoUri } = VALID_ENV;
    Object.assign(process.env, withoutMongoUri);
    await expect(import('@/config/env')).rejects.toThrow();
  });

  it('LOG_LEVEL 기본값 info', async () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.LOG_LEVEL;
    const { env } = await import('@/config/env');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('잘못된 URL 형식 시 ZodError throw', async () => {
    Object.assign(process.env, { ...VALID_ENV, AVAIL_RPC_URL: 'not-a-url' });
    await expect(import('@/config/env')).rejects.toThrow();
  });
});
