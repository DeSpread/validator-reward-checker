# Plan: Phase 1-3 — 공통 인프라

> **Feature**: `common-infrastructure`
> **Phase**: Plan
> **작성일**: 2026-03-18
> **참고 문서**: [PRD.md](../../PRD.md) | [ARCHITECTURE.md](../../ARCHITECTURE.md) | [TASK.md](../../TASK.md)

---

## 1. 목표 (Objective)

Fetcher 및 서비스 레이어가 공통으로 사용하는 인프라 모듈 5개를 구현한다.
로깅(`logger.ts`), 재시도(`retry.ts`), 고정밀 단위 변환(`bignum.ts`),
Fetcher 인터페이스(`base.fetcher.ts`), 환경 변수 검증(`env.ts`)을 완성하여
Phase 1-4 Avail Fetcher 구현이 즉시 착수 가능한 상태를 만든다.

---

## 2. 배경 및 이유 (Background)

- Phase 1-2에서 MongoDB 클라이언트와 시드 데이터가 준비된 상태
- Phase 1-4 Avail Fetcher는 `withRetry`, `toHuman`, `IFetcher`, `env`, `logger` 모두에 의존
- 환경 변수가 런타임에 누락되면 잘못된 에러가 발생하므로 시작 시 zod로 일괄 검증 필요
- 블록체인 잔고는 18자리 정수(planck 단위)이므로 JavaScript `number`로 처리 시
  부동소수점 오차가 필연적으로 발생 → `bignumber.js` 래퍼 필수
- 공개 RPC 레이트리밋·일시 장애로 인한 fetch 실패는 재시도 로직으로 흡수해야 함

---

## 3. 범위 (Scope)

### In Scope

| 파일 | 설명 |
|------|------|
| `src/utils/logger.ts` | pino 기반 구조화 로그 (JSON 출력, `level`·`service` 필드 포함) |
| `src/utils/retry.ts` | `withRetry(fn, options)` — 지수 백오프 재시도 유틸 |
| `src/utils/bignum.ts` | `toHuman(planck, decimals)` — planck → 사람이 읽는 단위 변환 |
| `src/fetchers/base.fetcher.ts` | `IFetcher` 인터페이스 + `FetchResult` 타입 |
| `src/config/env.ts` | zod 스키마로 환경 변수 파싱 및 런타임 검증 |
| `tests/utils/retry.test.ts` | `withRetry` 단위 테스트 |
| `tests/utils/bignum.test.ts` | `toHuman` 단위 테스트 (정밀도 검증) |
| `tests/config/env.test.ts` | `env.ts` zod 검증 단위 테스트 |

### Out of Scope

- Avail Fetcher 구현 — Phase 1-4에서 처리
- StorageService / RewardCalculator — Phase 1-4에서 처리
- Slack / Google Sheets 연동 — Phase 4에서 처리

---

## 4. 요구사항 (Requirements)

### 기능 요구사항

| ID | 요구사항 |
|----|----------|
| R-01 | `logger`는 JSON 형식으로 출력하며 `chain`, `date`, `error` 등 컨텍스트 필드를 지원해야 함 |
| R-02 | `withRetry`는 `maxAttempts`, `baseDelayMs` 옵션을 받아 지수 백오프로 재시도해야 함 |
| R-03 | `withRetry`는 maxAttempts 초과 시 마지막 에러를 그대로 throw해야 함 |
| R-04 | `toHuman(planck, decimals)`은 `string` 타입으로 반환해야 함 (`number` 변환 금지) |
| R-05 | `IFetcher` 인터페이스는 `projectName`, `fetchType`, `fetch(date: string): Promise<FetchResult>` 를 포함해야 함 |
| R-06 | `FetchResult`는 `ok: true` 성공 케이스와 `ok: false` 실패 케이스를 union type으로 표현해야 함 |
| R-07 | `env.ts`는 앱 시작 시 필수 환경 변수를 zod로 파싱하고, 누락/잘못된 값이 있으면 즉시 에러를 throw해야 함 |
| R-08 | `env.ts`는 파싱된 환경 변수를 typed object로 export해야 함 (직접 `process.env` 접근 방지) |

### 비기능 요구사항

| ID | 요구사항 |
|----|----------|
| NR-01 | `retry.ts`, `bignum.ts`는 외부 의존성 없는 순수 함수여야 함 (테스트 용이성) |
| NR-02 | `logger.ts`는 `pino` 외 추가 의존성 없이 구현 |
| NR-03 | TypeScript `strict: true` 준수 — `any` 사용 금지 |

---

## 5. 기술 결정 사항 (Technical Decisions)

### 5-1. logger.ts — pino 설정

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'validator-reward-checker' },
});
```

- JSON 구조화 출력으로 운영 환경 로그 수집 용이
- `LOG_LEVEL` 환경 변수로 동적 레벨 조정 가능

### 5-2. retry.ts — 지수 백오프

```typescript
// src/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; baseDelayMs: number }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < options.maxAttempts) {
        await sleep(options.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}
```

- 재시도 간격: `baseDelayMs * 2^(attempt-1)` (1s → 2s → 4s)
- 마지막 에러를 그대로 re-throw하여 호출자가 에러 타입 보존

### 5-3. bignum.ts — 정밀 단위 변환

```typescript
// src/utils/bignum.ts
import BigNumber from 'bignumber.js';

export function toHuman(planck: string, decimals: number): string {
  return new BigNumber(planck)
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed();  // 지수 표기 없는 string 반환
}
```

- `bignumber.js`는 이미 `package.json`에 포함된 의존성
- `.toFixed()`: 지수 표기(`1e-18`) 없이 소수점 string 반환

### 5-4. base.fetcher.ts — IFetcher 인터페이스

```typescript
// src/fetchers/base.fetcher.ts
export type FetchResult =
  | { ok: true; data: SnapshotData }
  | { ok: false; error: string };

export interface IFetcher {
  readonly projectName: string;
  readonly fetchType: 'A' | 'B' | 'C';
  fetch(date: string): Promise<FetchResult>;
}
```

- `fetchType`은 PRD의 3가지 수집 방식(`A`: 잔고차, `B`: REST API, `C`: ERC-20 Transfer)
- Discriminated union으로 호출자가 `.ok` 체크 후 타입 안전하게 접근 가능

### 5-5. env.ts — zod 환경 변수 검증

```typescript
// src/config/env.ts
import { z } from 'zod';

const schema = z.object({
  MONGO_DB_URI: z.string().min(1),
  AVAIL_RPC_URL: z.string().url(),
  AVAIL_WALLET_ADDRESS: z.string().min(1),
  // ... 기타 필수 환경 변수
  LOG_LEVEL: z.enum(['trace','debug','info','warn','error']).default('info'),
});

export const env = schema.parse(process.env);
```

- 앱 진입점(`src/index.ts`, `src/cli.ts`) import 시 즉시 검증
- 누락 시 상세한 zod 에러 메시지 출력 후 프로세스 종료

---

## 6. 파일 목록 (Deliverables)

| 파일 | 유형 | 설명 |
|------|------|------|
| `src/utils/logger.ts` | 신규 | pino 로거 singleton export |
| `src/utils/retry.ts` | 신규 | `withRetry` 유틸 함수 |
| `src/utils/bignum.ts` | 신규 | `toHuman` 단위 변환 함수 |
| `src/fetchers/base.fetcher.ts` | 신규 | `IFetcher` 인터페이스, `FetchResult` 타입 |
| `src/config/env.ts` | 신규 | zod 환경 변수 파싱 + export |
| `tests/utils/retry.test.ts` | 신규 | `withRetry` 단위 테스트 |
| `tests/utils/bignum.test.ts` | 신규 | `toHuman` 단위 테스트 |
| `tests/config/env.test.ts` | 신규 | `env.ts` zod 검증 테스트 |

---

## 7. 완료 기준 (Definition of Done)

- [ ] `npm test` 실행 시 `retry.test.ts`, `bignum.test.ts`, `env.test.ts` 모두 통과
- [ ] `toHuman('1000000000000000000', 18)` → `'1'` 반환 확인
- [ ] `toHuman('1500000000000000000', 18)` → `'1.5'` 반환 확인 (부동소수점 오차 없음)
- [ ] `withRetry`가 3회 실패 후 에러를 throw하는 테스트 통과
- [ ] `withRetry`의 딜레이 간격이 `vi.useFakeTimers()`로 검증됨
- [ ] `env.ts`에서 필수 변수 누락 시 zod 에러가 throw되는 테스트 통과
- [ ] `IFetcher` 인터페이스를 구현하지 않은 클래스는 TypeScript 컴파일 에러 발생
- [ ] `npm run build` 에러 없이 통과

---

## 8. 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| `env.ts` import 순서에 따라 검증 전에 `process.env` 접근 가능성 | 모든 서비스/fetcher에서 `process.env` 직접 접근 금지, `env.*` 사용 강제 (코드 컨벤션) |
| `bignumber.js` `.toFixed()` 가 매우 긴 소수 출력 | `toFixed(precision)` 옵션으로 최대 소수점 자리 제한 검토 (Phase 1-4에서 결정) |
| `withRetry` fake timer 테스트에서 `async/await` + `vi.useFakeTimers()` 충돌 | `vi.runAllTimersAsync()` 사용으로 해결 |

---

## 9. 다음 Phase 연계

이 Phase 완료 후 → **Phase 1-4 (Avail Fetcher)**:
- `IFetcher` 구현체인 `src/fetchers/avail.fetcher.ts` 작성
- `withRetry`, `toHuman`, `logger`, `env` 모두 즉시 사용 가능
