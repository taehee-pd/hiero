/**
 * Ambient declarations for `hungarian-on3` (no upstream types).
 *
 * The package's CommonJS default export is a function that takes a
 * cost matrix (array-of-arrays) and returns the optimal assignment
 * as `Array<[workerIndex, jobIndex]>`. `jobIndex` is `-1` for
 * unassigned workers (rectangular cases).
 *
 * Used by `lib/runtime-core/cascade-tiers/hungarian-matcher.ts`.
 */
declare module 'hungarian-on3' {
  function hungarian(
    costMatrix: number[][],
    isProfit?: boolean,
  ): Array<[number, number]>;
  export default hungarian;
}
