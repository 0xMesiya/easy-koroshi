export const scheduleAt = (timestamp, fn) => {
  const delay = timestamp - Date.now();
  if (delay < 0) return fn();
  setTimeout(fn, delay);
};
