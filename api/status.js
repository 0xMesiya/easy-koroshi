import { apiGet } from "./fetchData.js";

export const getActiveTrainings = async () => {
  const data = await apiGet(
    "https://www.api.thekoroshi.com/api/trpc/getMyNftTrainings"
  );
  const timers = {};
  for (const entry of data) {
    timers[entry.nftId] = new Date(entry.endAt).getTime();
  }
  return timers;
};

export const getActiveFights = async () => {
  const data = await apiGet(
    "https://www.api.thekoroshi.com/api/trpc/getMyTribeFights"
  );
  const timers = {};
  for (const entry of data) {
    timers[entry.nftId] = new Date(entry.endAt).getTime();
  }
  return timers;
};

export const getActiveLevelUps = async () => {
  const data = await apiGet(
    "https://www.api.thekoroshi.com/api/trpc/getMyNftLevelUps"
  );
  const timers = {};
  for (const entry of data) {
    timers[entry.nftId] = new Date(entry.endAt).getTime();
  }
  return timers;
};
