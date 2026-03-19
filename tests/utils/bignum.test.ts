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

  it('부동소수점 오차 없음 (0.3 케이스)', () => {
    expect(toHuman('300000000000000000', 18)).toBe('0.3');
  });

  it('string 타입 반환', () => {
    expect(typeof toHuman('1000000000000000000', 18)).toBe('string');
  });

  it('지수 표기 없음 (매우 작은 값)', () => {
    const result = toHuman('1', 18);
    expect(result).not.toMatch(/e/i);
  });
});
