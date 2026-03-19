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
