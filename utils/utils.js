export const formatDateTime = (ts) => {
  if (!ts) return "ready";
  const d = new Date(ts),
    t = d.toLocaleTimeString(),
    day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${t} ${day}`;
};

export const logDateTime = (ts) =>
  new Date(ts).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
