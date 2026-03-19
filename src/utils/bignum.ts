import BigNumber from 'bignumber.js';

/**
 * planck 단위 정수 문자열을 사람이 읽는 토큰 단위로 변환.
 * @param planck - planck 단위 정수 (string)
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
