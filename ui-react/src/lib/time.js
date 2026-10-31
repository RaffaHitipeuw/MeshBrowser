// Time helpers of the list pages.
//
// Port of the day/time formatting of ui/js/history.js and ui/js/downloads.js.

function parseTs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  // Some entries carry seconds instead of milliseconds.
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dayKey(ts) {
  const d = parseTs(ts);
  if (!d) {
    return "unknown";
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayLabel(ts) {
  const d = parseTs(ts);
  if (!d) {
    return "Unknown date";
  }
  const entryDay = startOfLocalDay(d).getTime();
  const today = startOfLocalDay(new Date()).getTime();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = startOfLocalDay(yesterdayDate).getTime();
  if (entryDay === today) {
    return "Today";
  }
  if (entryDay === yesterday) {
    return "Yesterday";
  }
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function timeLabel(ts) {
  const d = parseTs(ts);
  if (!d) {
    return "";
  }
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
