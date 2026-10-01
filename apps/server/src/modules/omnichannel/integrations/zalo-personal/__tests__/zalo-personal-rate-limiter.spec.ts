import { ZaloPersonalRateLimiterService } from '../zalo-personal-rate-limiter.service';

describe('ZaloPersonalRateLimiterService', () => {
  it('should allow the first send immediately', async () => {
    const limiter = new ZaloPersonalRateLimiterService();
    const start = Date.now();
    await limiter.acquire('chan_1');
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('should space out consecutive sends per channel', async () => {
    const limiter = new ZaloPersonalRateLimiterService();
    await limiter.acquire('chan_1', 1_000);
    const start = Date.now();
    await limiter.acquire('chan_1', 1_000 + 200); // only 200ms elapsed → wait ~1300ms
    expect(Date.now() - start).toBeGreaterThanOrEqual(1000);
  });

  it('should track channels independently', async () => {
    const limiter = new ZaloPersonalRateLimiterService();
    await limiter.acquire('chan_1', 1_000);
    const start = Date.now();
    await limiter.acquire('chan_2', 1_000 + 100);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('should throw once the daily cap is exceeded and reset the next day', async () => {
    const limiter = new ZaloPersonalRateLimiterService();
    const base = new Date('2026-10-02T10:00:00Z').getTime();
    for (let i = 0; i < 300; i++) {
      // Advance the virtual clock by 2s per send so no real spacing sleep occurs.
      await limiter.acquire('chan_1', base + i * 2000);
    }
    await expect(limiter.acquire('chan_1', base + 300 * 2000)).rejects.toThrow(
      /DAILY_LIMIT_EXCEEDED/,
    );

    // Next day: cap resets
    const nextDay = new Date('2026-10-03T10:00:00Z').getTime();
    await expect(limiter.acquire('chan_1', nextDay)).resolves.toBeUndefined();
  });
});
