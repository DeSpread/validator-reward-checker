# Analysis: Phase 1-3 — 공통 인프라

> **Feature**: `common-infrastructure`
> **Phase**: Check (Gap Analysis)
> **작성일**: 2026-03-19
> **참고 문서**: [Design](../02-design/features/common-infrastructure.design.md)

---

## Match Rate: 97%

> 29개 항목 일치 / 1개 minor divergence / 2개 개선 추가

---

## Matched Items (29/30)

### src/utils/logger.ts
- [x] `pino` import 및 singleton export
- [x] `level: process.env.LOG_LEVEL ?? 'info'` 설정
- [x] `base: { service: 'validator-reward-checker' }` 필드

### src/utils/retry.ts
- [x] `RetryOptions` 인터페이스 (`maxAttempts`, `baseDelayMs`)
- [x] `withRetry<T>(fn, options)` 제네릭 함수 시그니처
- [x] 지수 백오프: `baseDelayMs * 2 ** (attempt - 1)`
- [x] `lastError` re-throw (에러 타입 보존)
- [x] `sleep()` 분리 (vi.useFakeTimers 테스트 가능)
- [x] `logger.warn` 재시도 로그

### src/utils/bignum.ts
- [x] `BigNumber` import
- [x] `toHuman(planck: string, decimals: number): string` 시그니처
- [x] `.dividedBy(new BigNumber(10).pow(decimals)).toFixed()` 구현
- [x] JSDoc 예시 (`toHuman('1000000000000000000', 18) // '1'`)

### src/fetchers/base.fetcher.ts
- [x] `SnapshotData` 인터페이스 (projectId, snapshotDate, balance?, rewardAmount?, fetchType, rawData?)
- [x] `FetchResult` discriminated union (`ok: true | false`)
- [x] `IFetcher` 인터페이스 (projectName, fetchType, fetch)
- [x] `fetchType: 'A' | 'B' | 'C'` literal type

### src/config/env.ts
- [x] zod `envSchema` 19개 환경 변수 정의
- [x] `MONGO_DB_URI`, `AVAIL_*`, `STACKS_*`, `STORY_*`, `BERA_*`, `INFRARED_*`, `HYPERLIQUID_*`, `MONAD_*`
- [x] `LOG_LEVEL` enum with `.default('info')`
- [x] `export type Env = z.infer<typeof envSchema>`
- [x] `export const env: Env = envSchema.parse(process.env)`

### tests/utils/retry.test.ts
- [x] 1회 성공 시 즉시 반환
- [x] 2회 실패 후 성공 시 정상 반환
- [x] maxAttempts 초과 시 마지막 에러 throw
- [x] 지수 백오프 딜레이 간격 검증 (`vi.useFakeTimers`)

### tests/utils/bignum.test.ts
- [x] `toHuman('1000000000000000000', 18)` → `'1'`
- [x] `toHuman('1500000000000000000', 18)` → `'1.5'`
- [x] `toHuman('150000000', 8)` → `'1.5'`
- [x] `toHuman('300000000000000000', 18)` → `'0.3'` (부동소수점 오차 없음)
- [x] string 타입 반환
- [x] 지수 표기 없음

### tests/config/env.test.ts
- [x] 유효한 환경 변수 세트로 정상 파싱
- [x] 필수 변수 누락 시 ZodError throw
- [x] LOG_LEVEL 기본값 info

---

## Gaps

| ID | 파일 | 항목 | 상태 | 설명 |
|----|------|------|------|------|
| GAP-01 | `src/utils/bignum.ts` | JSDoc `@param planck` 타입 설명 | Minor Divergence | Design 문서에는 `string 또는 BigNumber` 라고 적혀 있으나 구현 시그니처는 `string`만 허용. 의도적 선택 (string 강제로 number 변환 차단). 기능 영향 없음 |

---

## 개선 추가 (설계 대비 품질 향상)

| ID | 파일 | 항목 | 설명 |
|----|------|------|------|
| ADD-01 | `tests/utils/retry.test.ts` | unhandled rejection 방지 패턴 | `expect(promise).rejects.toThrow()` 를 `vi.runAllTimersAsync()` 이전에 등록하여 Node.js 경고 제거 |
| ADD-02 | `tests/config/env.test.ts` | 잘못된 URL 형식 테스트 | Design 문서에 없던 `AVAIL_RPC_URL: 'not-a-url'` 케이스 추가 |

---

## 테스트 결과

```
Test Files  3 passed (3)
     Tests  14 passed (14)
    Errors  0
  Duration  262ms
```

---

## 결론

**Match Rate 97%** — 설계 대비 구현이 거의 완벽하게 일치합니다.

- GAP-01은 의도적인 타입 강화 (string-only)로 설계 의도를 벗어나지 않음
- 2개 개선 항목은 품질을 높이는 방향의 추가 구현
- `npm run build` 및 `npm test` 모두 이상 없음

**다음 단계**: `/pdca report common-infrastructure` 로 완료 보고서 생성 가능
