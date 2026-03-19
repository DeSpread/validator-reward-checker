import { Db } from 'mongodb';
import { getDb, closeDb } from './client';

interface ValidatorProject {
  name: string;
  chain: string;
  tokenSymbol: string;
  fetchType: 'A' | 'B' | 'C';
  walletAddress: string;
  startDate: string;
  isActive: boolean;
  createdAt: Date;
}

const SEED_PROJECTS: Omit<ValidatorProject, 'createdAt'>[] = [
  { name: 'Avail Validator',          chain: 'avail',       tokenSymbol: 'AVAIL', fetchType: 'A', walletAddress: '', startDate: '2025-01-20', isActive: true },
  { name: 'Stacks Signer',            chain: 'stacks',      tokenSymbol: 'BTC',   fetchType: 'B', walletAddress: '', startDate: '2024-04-29', isActive: true },
  { name: 'Story Validator',          chain: 'story',       tokenSymbol: 'IP',    fetchType: 'B', walletAddress: '', startDate: '2025-03-05', isActive: true },
  { name: 'Bera Validator',           chain: 'bera',        tokenSymbol: 'BGT',   fetchType: 'C', walletAddress: '', startDate: '2025-02-06', isActive: true },
  { name: 'Infrared Bera Validator',  chain: 'infrared',    tokenSymbol: 'iBERA', fetchType: 'C', walletAddress: '', startDate: '2025-04-21', isActive: true },
  { name: 'Hyperliquid',              chain: 'hyperliquid', tokenSymbol: 'HYPE',  fetchType: 'B', walletAddress: '', startDate: '2025-04-22', isActive: true },
  { name: 'Monad',                    chain: 'monad',       tokenSymbol: 'MON',   fetchType: 'C', walletAddress: '', startDate: '2025-11-13', isActive: true },
];

async function createIndexes(db: Db): Promise<void> {
  await db.collection('balance_snapshots').createIndex(
    { projectId: 1, snapshotDate: 1 },
    { unique: true, name: 'projectId_snapshotDate_unique' }
  );

  await db.collection('token_transfer_snapshots').createIndex(
    { projectId: 1, snapshotDate: 1, tokenSymbol: 1 },
    { unique: true, name: 'projectId_snapshotDate_tokenSymbol_unique' }
  );

  await db.collection('withdrawal_records').createIndex(
    { projectId: 1, withdrawnAt: -1 },
    { name: 'projectId_withdrawnAt_desc' }
  );
}

async function seedValidatorProjects(db: Db): Promise<void> {
  const col = db.collection('validator_projects');

  for (const project of SEED_PROJECTS) {
    const doc: ValidatorProject = { ...project, createdAt: new Date() };
    await col.updateOne(
      { chain: project.chain },
      { $setOnInsert: doc },
      { upsert: true }
    );
  }
}

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

main().catch((err: unknown) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
