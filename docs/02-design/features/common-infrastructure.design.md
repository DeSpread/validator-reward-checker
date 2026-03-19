# Design: Phase 1-3 — 공통 인프라

> **Feature**: `common-infrastructure`
> **Phase**: Design
> **작성일**: 2026-03-18
> **참고 문서**: [Plan](../../01-plan/features/common-infrastructure.plan.md) | [ARCHITECTURE.md](../../ARCHITECTURE.md)

---

## 1. 개요

Fetcher 및 서비스 레이어 전반이 공유하는 5개 인프라 모듈을 구현한다.
모든 모듈은 Phase 1-4 Avail Fetcher 구현 전에 완성되어야 한다.

---

## 2. 파일 구조

```
src/
├── utils/
│   ├── logger.ts          # pino 로거 singleton
│   ├── retry.ts           # withRetry() 지수 백오프 유틸
│   └── bignum.ts          # toHuman() planck → 사람 단위 변환
├── fetchers/
│   └── base.fetcher.ts    # IFetcher 인터페이스 + FetchResult 타입
└── config/
    └── env.ts             # zod 환경 변수 파싱 + export

tests/
├── utils/
│   ├── retry.test.ts
│   └── bignum.test.ts
└── config/
    └── env.test.ts
```

---

## 3. `src/utils/logger.ts` 설계

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'validator-reward-checker' },
});
```

**사용 예시**:
```typescript
import { logger } from '@/utils/logger';

logger.info({ chain: 'avail', date: '2026-03-18', balance: '1.5' }, 'snapshot fetched');
logger.error({ chain: 'avail', error }, 'fetch failed after retries');
```

**설계 결정**:
- `pino` 기본 JSON 출력 — 운영 환경 로그 수집 도구(Datadog, CloudWatch)와 호환
- `base` 필드에 `service` 추가 — 멀티 서비스 환경에서 로그 출처 식별
- `LOG_LEVEL` 환경 변수 미설정 시 `'info'` 기본값 (개발/운영 동일)

---

## 4. `src/utils/retry.ts` 설계

### 4-1. 타입 정의

```typescript
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}
```

### 4-2. 구현

```typescript
import { logger } from '@/utils/logger';

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
```

**재시도 간격**:

| attempt | delay (baseDelayMs=1000) |
|---------|--------------------------|
| 1 실패 → 2회차 | 1,000ms |
| 2 실패 → 3회차 | 2,000ms |
| 3 실패 | throw |

**설계 결정**:
- `lastError`를 그대로 re-throw — 호출자가 에러 타입 유지
- `sleep` 함수를 별도 분리 — `vi.useFakeTimers()`로 테스트 가능
- maxAttempts=3, baseDelayMs=1000 이 CLAUDE.md 기준 기본값

---

## 5. `src/utils/bignum.ts` 설계

```typescript
import BigNumber from 'bignumber.js';

/**
 * planck 단위 정수 문자열을 사람이 읽는 토큰 단위로 변환.
 * @param planck - planck 단위 정수 (string 또는 BigNumber)
 * @param decimals - 소수점 자리수 (AVAIL: 18, BTC: 8)
 * @returns 소수점 string (지수 표기 없음)
 *
 * @example
 * toHuman('1000000000000000000', 18) // '1'
 * toHuman('1500000000000000000', 18) // '1.5'
 * toHuman('150000000', 8)            // '1.5'
 */
export function toHuman(planck: string, decimals: number): string {
  return new BigNumber(planck)
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed();
}
```

**설계 결정**:
- 입력을 `string`으로만 받아 JavaScript `number` 변환 차단
- `.toFixed()` (precision 미지정): trailing zero 없이 최소 소수점 자리 반환
- `bignumber.js`는 이미 `package.json` runtime 의존성에 포함

---

## 6. `src/fetchers/base.fetcher.ts` 설계

```typescript
export interface SnapshotData {
  projectId: string;
  snapshotDate: string;      // "YYYY-MM-DD"
  balance?: string;          // Type A: 잔고 (planck string)
  rewardAmount?: string;     // 계산된 리워드 (human 단위 string)
  fetchType: 'A' | 'B' | 'C';
  rawData?: unknown;         // 체인별 원시 응답 (디버깅용)
}

export type FetchResult =
  | { ok: true; data: SnapshotData }
  | { ok: false; error: string };

export interface IFetcher {
  readonly projectName: string;
  readonly fetchType: 'A' | 'B' | 'C';
  fetch(date: string): Promise<FetchResult>;
}
```

**사용 예시**:
```typescript
// 구현체
class AvailFetcher implements IFetcher {
  readonly projectName = 'avail';
  readonly fetchType = 'A' as const;

  async fetch(date: string): Promise<FetchResult> {
    try {
      // ...
      return { ok: true, data: { ... } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// 호출자 (타입 안전한 분기)
const result = await fetcher.fetch('2026-03-18');
if (result.ok) {
  console.log(result.data.balance);   // SnapshotData
} else {
  console.error(result.error);        // string
}
```

**설계 결정**:
- Discriminated union (`ok: true | false`) 으로 try-catch 없이 결과 처리
- `SnapshotData.rawData?: unknown` — 디버깅/로깅용 원시 응답 선택적 포함
- `fetchType`은 `'A' | 'B' | 'C'` literal type (PRD 3가지 수집 방식)

---

## 7. `src/config/env.ts` 설계

### 7-1. zod 스키마

```typescript
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
```

### 7-2. 실패 시 동작

```
ZodError: [
  { path: ['MONGO_DB_URI'], message: 'Required' },
  { path: ['AVAIL_RPC_URL'], message: 'Invalid url' },
]
```

- `envSchema.parse()` 실패 시 `ZodError` throw → 앱 시작 중단
- 누락된 모든 필드를 한번에 표시 (`.safeParse()` 대신 `.parse()` 사용)

### 7-3. 사용 방법

```typescript
// ✅ 올바른 방법 — env 모듈 import
import { env } from '@/config/env';
const client = new MongoClient(env.MONGO_DB_URI);

// ❌ 금지 — process.env 직접 접근
const client = new MongoClient(process.env.MONGO_DB_URI!);
```

---

## 8. 테스트 설계

### 8-1. `tests/utils/retry.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '@/utils/retry';

describe('withRetry', () => {
  it('1회 성공 시 즉시 반환', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('2회 실패 후 3회 성공 시 정상 반환', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('maxAttempts 초과 시 마지막 에러 throw', async () => {
    vi.useFakeTimers();
    const error = new Error('always fail');
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000 });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('지수 백오프 딜레이 간격 검증', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000 });
    await vi.runAllTimersAsync();
    await promise;

    // 1회 실패 → 1000ms, 2회 실패 → 2000ms
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toContain(1000);
    expect(delays).toContain(2000);
    vi.useRealTimers();
  });
});
```

### 8-2. `tests/utils/bignum.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { toHuman } from '@/utils/bignum';

describe('toHuman', () => {
  it('1 AVAIL (18 decimals)', () => {
    expect(toHuman('1000000000000000000', 18)).toBe('1');
  });

  it('1.5 AVAIL (18 decimals)', () => {
    expect(toHuman('1500000000000000000', 18)).toBe('1.5');
  });

  it('1.5 BTC (8 decimals)', () => {
    expect(toHuman('150000000', 8)).toBe('1.5');
  });

  it('부동소수점 오차 없음 (0.1 + 0.2 케이스)', () => {
    // 0.3 AVAIL = 300000000000000000 planck
    expect(toHuman('300000000000000000', 18)).toBe('0.3');
  });

  it('string 타입 반환', () => {
    expect(typeof toHuman('1000000000000000000', 18)).toBe('string');
  });

  it('지수 표기 없음 (매우 작은 값)', () => {
    // 1 planck (10^-18 AVAIL)
    const result = toHuman('1', 18);
    expect(result).not.toMatch(/e/i);
  });
});
```

### 8-3. `tests/config/env.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const VALID_ENV = {
  MONGO_DB_URI: 'mongodb://localhost:27017/validator_rewards',
  AVAIL_RPC_URL: 'wss://avail-rpc.example.com',
  AVAIL_WALLET_ADDRESS: '5GrwvaEF...',
  STACKS_API_URL: 'https://stacks-api.example.com',
  STACKS_WALLET_ADDRESS: 'SP...',
  STORY_RPC_URL: 'https://story-rpc.example.com',
  STORY_WALLET_ADDRESS: '0x...',
  STORY_VALIDATOR_ADDRESS: '0x...',
  BERA_RPC_URL: 'https://bera-rpc.example.com',
  BERA_WALLET_ADDRESS: '0x...',
  BERA_BGT_VAULT_ADDRESS: '0x...',
  INFRARED_RPC_URL: 'https://infrared-rpc.example.com',
  INFRARED_WALLET_ADDRESS: '0x...',
  INFRARED_TOKEN_ADDRESS: '0x...',
  HYPERLIQUID_API_URL: 'https://hl-api.example.com',
  HYPERLIQUID_WALLET_ADDRESS: '0x...',
  MONAD_RPC_URL: 'https://monad-rpc.example.com',
  MONAD_WALLET_ADDRESS: '0x...',
  MONAD_TOKEN_ADDRESS: '0x...',
};

describe('env', () => {
  beforeEach(() => {
    // 모듈 캐시 초기화 (env.ts는 모듈 로드 시 parse 실행)
    vi.resetModules();
  });

  it('유효한 환경 변수 세트로 정상 파싱', async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import('@/config/env');
    expect(env.MONGO_DB_URI).toBe(VALID_ENV.MONGO_DB_URI);
    expect(env.LOG_LEVEL).toBe('info'); // default
  });

  it('필수 변수 누락 시 ZodError throw', async () => {
    const { MONGO_DB_URI: _, ...withoutMongoUri } = VALID_ENV;
    Object.assign(process.env, withoutMongoUri);
    delete process.env.MONGO_DB_URI;
    await expect(import('@/config/env')).rejects.toThrow();
  });

  it('LOG_LEVEL 기본값 info', async () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.LOG_LEVEL;
    const { env } = await import('@/config/env');
    expect(env.LOG_LEVEL).toBe('info');
  });
});
```

---

## 9. 완료 기준 (Definition of Done)

- [ ] `npm test` 실행 시 `retry.test.ts`, `bignum.test.ts`, `env.test.ts` 모두 통과
- [ ] `toHuman('1000000000000000000', 18)` → `'1'` 검증
- [ ] `toHuman('300000000000000000', 18)` → `'0.3'` (부동소수점 오차 없음) 검증
- [ ] `withRetry` 3회 실패 후 throw 테스트 통과
- [ ] `env.ts`에서 `MONGO_DB_URI` 누락 시 ZodError 발생 확인
- [ ] `IFetcher` 미구현 클래스에서 TypeScript 컴파일 에러 발생
- [ ] `npm run build` 에러 없이 통과

---

## 10. 다음 Phase 연계

이 Design 완료 후 → **구현 (`/pdca do common-infrastructure`)**:
각 파일을 이 설계 문서 기준으로 작성. 구현 순서:
1. `src/utils/logger.ts` (의존성 없음, 먼저 작성)
2. `src/utils/retry.ts` (logger 의존)
3. `src/utils/bignum.ts` (의존성 없음)
4. `src/fetchers/base.fetcher.ts` (의존성 없음)
5. `src/config/env.ts` (zod 의존)
6. 테스트 파일 3개
