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
    // rejection 핸들러를 먼저 등록한 후 타이머 실행 (unhandled rejection 방지)
    const assertion = expect(promise).rejects.toThrow('always fail');
    await vi.runAllTimersAsync();
    await assertion;
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

    const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toContain(1000);
    expect(delays).toContain(2000);
    vi.useRealTimers();
  });
});
