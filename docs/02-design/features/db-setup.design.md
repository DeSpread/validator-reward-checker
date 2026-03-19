# Design: Phase 1-2 — DB 설정

> **Feature**: `db-setup`
> **Phase**: Design
> **작성일**: 2026-03-18
> **참고 문서**: [Plan](../../01-plan/features/db-setup.plan.md) | [ARCHITECTURE.md](../../ARCHITECTURE.md)

---

## 1. 개요

MongoDB 연결 클라이언트(`client.ts`)와 컬렉션 초기화 스크립트(`seed.ts`)를 구현한다.
`npm run db:init` 한 번으로 4개 컬렉션의 인덱스 생성과 7개 validator 프로젝트 시드 데이터 삽입이 완료되어야 한다.

---

## 2. 파일 구조

```
src/db/
├── client.ts     # MongoClient 싱글톤 — getDb() / closeDb()
└── seed.ts       # 인덱스 생성 + 시드 데이터 삽입 (멱등)
```

---

## 3. `src/db/client.ts` 설계

### 3-1. 인터페이스

```typescript
import { MongoClient, Db } from 'mongodb';

let _client: MongoClient | null = null;

/**
 * MongoDB 싱글톤 연결 반환.
 * 최초 호출 시 연결, 이후 캐시된 인스턴스 반환.
 */
export async function getDb(): Promise<Db> { ... }

/**
 * 연결 종료. 크론/CLI 프로세스 종료 시 반드시 호출.
 */
export async function closeDb(): Promise<void> { ... }
```

### 3-2. 구현 상세

```typescript
import { MongoClient, Db } from 'mongodb';

const MONGO_DB_URI = process.env.MONGO_DB_URI;
if (!MONGO_DB_URI) {
  throw new Error('MONGO_DB_URI environment variable is not set');
}

let _client: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!_client) {
    _client = new MongoClient(MONGO_DB_URI);
    await _client.connect();
  }
  return _client.db(); // URI에 DB명 포함 (validator_rewards)
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}
```

**주의사항**:
- `MONGO_DB_URI`는 모듈 로드 시 검증 (런타임 초기 실패 방지)
- `_client.db()`는 URI에 포함된 DB명 사용 (`mongodb://host/validator_rewards`)
- `closeDb()` 이후 `getDb()` 재호출 시 새 연결 생성
- `process.env` 직접 접근: 이 파일은 Phase 1-2에 작성되어 `env.ts`(Phase 1-3) 이전에 구현됨. Phase 1-3 완료 후 `import { env } from '@/config/env'` 방식으로 마이그레이션 검토

---

## 4. `src/db/seed.ts` 설계

### 4-1. 실행 흐름

```
seed.ts 실행
  │
  ├─ 1. getDb() 로 MongoDB 연결
  │
  ├─ 2. createIndexes() — 4개 컬렉션 인덱스 생성
  │    ├─ balance_snapshots: unique { projectId, snapshotDate }
  │    ├─ token_transfer_snapshots: unique { projectId, snapshotDate, tokenSymbol }
  │    ├─ withdrawal_records: { projectId, withdrawnAt: -1 }
  │    └─ validator_projects: 기본 _id 인덱스만 (추가 없음)
  │
  ├─ 3. seedValidatorProjects() — 7개 체인 upsert
  │    └─ updateOne({ chain }, { $setOnInsert: doc }, { upsert: true })
  │
  └─ 4. closeDb() → process.exit(0)
```

### 4-2. 인덱스 정의

```typescript
async function createIndexes(db: Db): Promise<void> {
  // balance_snapshots
  await db.collection('balance_snapshots').createIndex(
    { projectId: 1, snapshotDate: 1 },
    { unique: true, name: 'projectId_snapshotDate_unique' }
  );

  // token_transfer_snapshots
  await db.collection('token_transfer_snapshots').createIndex(
    { projectId: 1, snapshotDate: 1, tokenSymbol: 1 },
    { unique: true, name: 'projectId_snapshotDate_tokenSymbol_unique' }
  );

  // withdrawal_records
  await db.collection('withdrawal_records').createIndex(
    { projectId: 1, withdrawnAt: -1 },
    { name: 'projectId_withdrawnAt_desc' }
  );
}
```

### 4-3. `ValidatorProject` 타입 및 시드 데이터

```typescript
interface ValidatorProject {
  name: string;
  chain: string;
  tokenSymbol: string;
  fetchType: 'A' | 'B' | 'C';
  walletAddress: string;
  startDate: string;    // "YYYY-MM-DD"
  isActive: boolean;
  createdAt: Date;
}

const SEED_PROJECTS: Omit<ValidatorProject, 'createdAt'>[] = [
  { name: 'Avail Validator',           chain: 'avail',      tokenSymbol: 'AVAIL', fetchType: 'A', walletAddress: '', startDate: '2025-01-20', isActive: true },
  { name: 'Stacks Signer',             chain: 'stacks',     tokenSymbol: 'BTC',   fetchType: 'B', walletAddress: '', startDate: '2024-04-29', isActive: true },
  { name: 'Story Validator',           chain: 'story',      tokenSymbol: 'IP',    fetchType: 'B', walletAddress: '', startDate: '2025-03-05', isActive: true },
  { name: 'Bera Validator',            chain: 'bera',       tokenSymbol: 'BGT',   fetchType: 'C', walletAddress: '', startDate: '2025-02-06', isActive: true },
  { name: 'Infrared Bera Validator',   chain: 'infrared',   tokenSymbol: 'iBERA', fetchType: 'C', walletAddress: '', startDate: '2025-04-21', isActive: true },
  { name: 'Hyperliquid',               chain: 'hyperliquid',tokenSymbol: 'HYPE',  fetchType: 'B', walletAddress: '', startDate: '2025-04-22', isActive: true },
  { name: 'Monad',                     chain: 'monad',      tokenSymbol: 'MON',   fetchType: 'C', walletAddress: '', startDate: '2025-11-13', isActive: true },
];
```

**`walletAddress`**: 초기 시드는 빈 문자열. 운영 전 `.env`에서 주입하거나 CLI로 업데이트.

### 4-4. 멱등 upsert 로직

```typescript
async function seedValidatorProjects(db: Db): Promise<void> {
  const col = db.collection('validator_projects');

  for (const project of SEED_PROJECTS) {
    const doc: ValidatorProject = { ...project, createdAt: new Date() };
    await col.updateOne(
      { chain: project.chain },            // 필터: chain은 유니크 식별자
      { $setOnInsert: doc },               // 없을 때만 삽입
      { upsert: true }
    );
  }
}
```

### 4-5. 진입점 (main)

```typescript
async function main(): Promise<void> {
  const db = await getDb();

  console.log('[seed] Creating indexes...');
  await createIndexes(db);
  console.log('[seed] Indexes created.');

  console.log('[seed] Seeding validator_projects...');
  await seedValidatorProjects(db);
  console.log('[seed] Seed complete. 7 projects upserted.');

  await closeDb();
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
```

---

## 5. `package.json` 수정 사항

```json
{
  "scripts": {
    "db:init": "ts-node -r tsconfig-paths/register src/db/seed.ts"
  }
}
```

`tsconfig-paths/register` 플래그: `@/` path alias 사용 시 필요 (seed.ts에서 직접 사용 안 해도 일관성 유지).

---

## 6. MongoDB 스키마 참조

> 전체 스키마 정의는 [ARCHITECTURE.md § 3. DB 스키마](../../ARCHITECTURE.md)에서 관리.

| 컬렉션 | 인덱스 | unique |
|--------|--------|--------|
| `validator_projects` | `_id` (기본) | - |
| `balance_snapshots` | `{ projectId: 1, snapshotDate: 1 }` | ✅ |
| `token_transfer_snapshots` | `{ projectId: 1, snapshotDate: 1, tokenSymbol: 1 }` | ✅ |
| `withdrawal_records` | `{ projectId: 1, withdrawnAt: -1 }` | - |

---

## 7. 완료 기준 (Definition of Done)

- [ ] `npm run db:init` 실행 후 MongoDB에 인덱스 3개 생성 확인
- [ ] `npm run db:init` 재실행 시 에러 없이 정상 종료
- [ ] `validator_projects` 컬렉션에 7개 문서 존재
- [ ] `getDb()` 두 번 호출 시 동일 `MongoClient` 인스턴스 반환
- [ ] `closeDb()` 후 `_client`가 `null`로 초기화
- [ ] `MONGO_DB_URI` 미설정 시 명확한 에러 메시지 출력 후 즉시 종료

---

## 8. 다음 Phase 연계

이 Design 완료 후 → **구현 (`/pdca do db-setup`)**:
`src/db/client.ts`, `src/db/seed.ts` 파일을 이 설계 문서 기준으로 작성.
