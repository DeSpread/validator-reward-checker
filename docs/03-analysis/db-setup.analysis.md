# Gap Analysis: db-setup

> **Feature**: `db-setup`
> **Phase**: Check
> **작성일**: 2026-03-18
> **Design 문서**: [db-setup.design.md](../02-design/features/db-setup.design.md)

---

## 분석 요약

| 항목 | 점수 | 상태 |
|------|:----:|:----:|
| Design 일치율 | 100% | ✅ |
| 아키텍처 준수 | 100% | ✅ |
| 컨벤션 준수 | 100% | ✅ |
| **종합 Match Rate** | **100%** | ✅ |

---

## client.ts — 6/6 항목 일치

| # | Design 항목 | 상태 | 근거 |
|---|------------|:----:|------|
| 1 | `MONGO_DB_URI` 모듈 로드 시 검증 (`throw Error`) | ✅ | L3-6: 동일한 에러 메시지 |
| 2 | `_client: MongoClient \| null = null` 싱글톤 변수 | ✅ | L8 |
| 3 | `getDb()` 싱글톤 패턴 (최초 연결, 이후 캐시) | ✅ | L14-20 |
| 4 | `_client.db()` 인수 없이 호출 (URI DB명 사용) | ✅ | L19 |
| 5 | `closeDb()` — `close()` 후 `_client = null` 초기화 | ✅ | L25-30 |
| 6 | JSDoc 주석 | ✅ | L10-13, L24 |

---

## seed.ts — 10/10 항목 일치

| # | Design 항목 | 상태 | 근거 |
|---|------------|:----:|------|
| 1 | `ValidatorProject` 인터페이스 (8개 필드, 타입 일치) | ✅ | L4-13 |
| 2 | `SEED_PROJECTS` — 7개 체인 모두 존재 | ✅ | L15-23 |
| 3 | `balance_snapshots` unique index `{ projectId, snapshotDate }` | ✅ | L26-29 |
| 4 | `token_transfer_snapshots` unique index `{ projectId, snapshotDate, tokenSymbol }` | ✅ | L31-34 |
| 5 | `withdrawal_records` index `{ projectId, withdrawnAt: -1 }` | ✅ | L36-39 |
| 6 | `$setOnInsert` + `upsert: true` 멱등 삽입 | ✅ | L42-53 |
| 7 | `main()` 실행 순서: getDb → createIndexes → seedValidatorProjects → closeDb | ✅ | L55-67 |
| 8 | 콘솔 로그 메시지 | ✅ | L58-64 |
| 9 | 에러 시 `process.exit(1)` | ✅ | L69-72 |
| 10 | `err: unknown` 타입 어노테이션 (strict 준수) | ✅ | L69 |

---

## package.json — 1/1 항목 일치

| # | Design 항목 | 상태 | 근거 |
|---|------------|:----:|------|
| 1 | `db:init`: `ts-node -r tsconfig-paths/register src/db/seed.ts` | ✅ | package.json L15 |

---

## Gap 목록

**미구현 항목 (Design O, 구현 X)**: 없음

**추가 구현 항목 (Design X, 구현 O)**:
- `seed.ts:69` — `err: unknown` 타입 어노테이션 (설계보다 개선된 strict 준수)

---

## 결론

**Match Rate: 17/17 = 100%** ✅

설계 문서와 구현이 완전히 일치합니다. Check 단계 통과.
