const TIMEZONE = process.env.APP_TIMEZONE || 'America/Costa_Rica';

function nowInTZ() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function todayISO(tz = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function nowTimeISO(tz = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('hour')}:${get('minute')}`;
}

function addDaysISO(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { TIMEZONE, nowInTZ, todayISO, nowTimeISO, addDaysISO };
