import { MongoClient, Db } from 'mongodb';

const MONGO_DB_URI = process.env.MONGO_DB_URI;
if (!MONGO_DB_URI) {
  throw new Error('MONGO_DB_URI environment variable is not set');
}

let _client: MongoClient | null = null;

/**
 * MongoDB 싱글톤 연결 반환.
 * 최초 호출 시 연결, 이후 캐시된 인스턴스 반환.
 */
export async function getDb(): Promise<Db> {
  if (!_client) {
    _client = new MongoClient(MONGO_DB_URI as string);
    await _client.connect();
  }
  return _client.db();
}

/**
 * 연결 종료. 크론/CLI 프로세스 종료 시 반드시 호출.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}
