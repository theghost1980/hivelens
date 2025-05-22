
/**
 * @fileOverview Utility class for measuring execution time.
 */

export class TimeUtils {
  /**
   * Returns the current high-resolution real time in a [seconds, nanoseconds] tuple Array.
   */
  static start(): [number, number] {
    return process.hrtime();
  }

  /**
   * Calculates the time difference between a start time and now.
   * @param startTime - The start time obtained from `TimeUtils.start()`.
   * @returns The time difference in milliseconds.
   */
  static calculate(startTime: [number, number]): number {
    const endTime = process.hrtime(startTime);
    // Convert [seconds, nanoseconds] to milliseconds
    return (endTime[0] * 1000 + endTime[1] / 1000000);
  }
}
