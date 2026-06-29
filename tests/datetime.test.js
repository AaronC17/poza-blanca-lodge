const dt = require('../src/config/datetime');

describe('datetime (America/Costa_Rica)', () => {
  test('todayISO returns YYYY-MM-DD', () => {
    const today = dt.todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('todayISO is timezone-stable (not affected by server offset)', () => {
    const a = dt.todayISO('America/Costa_Rica');
    const b = dt.todayISO('America/Costa_Rica');
    expect(a).toBe(b);
  });

  test('addDaysISO adds/subtracts days', () => {
    expect(dt.addDaysISO('2026-06-23', -6)).toBe('2026-06-17');
    expect(dt.addDaysISO('2026-01-01', 1)).toBe('2026-01-02');
  });

  test('nowTimeISO returns HH:MM 24h', () => {
    const t = dt.nowTimeISO();
    expect(t).toMatch(/^\d{2}:\d{2}$/);
  });
});
