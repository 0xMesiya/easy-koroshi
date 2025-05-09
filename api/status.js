import { apiGet } from "./fetchData.js";

export const getActiveTrainings = async () => {
  const timers = {};
  try {
    const data = await apiGet(
      "https://www.api.thekoroshi.com/api/trpc/getMyNftTrainings"
    );
    for (const entry of data) {
      timers[entry.nftId] = new Date(entry.endAt).getTime();
    }
    return timers;
  } catch (e) {
    return timers;
  }
};

export const getActiveFights = async () => {
  const timers = {};
  try {
    const data = await apiGet(
      "https://www.api.thekoroshi.com/api/trpc/getMyTribeFights"
    );
    for (const entry of data) {
      timers[entry.nftId] = new Date(entry.endAt).getTime();
    }
    return timers;
  } catch (e) {
    return timers;
  }
};

export const getActiveLevelUps = async () => {
  const timers = {};
  try {
    const data = await apiGet(
      "https://www.api.thekoroshi.com/api/trpc/getMyNftLevelUps"
    );
    for (const entry of data) {
      timers[entry.nftId] = new Date(entry.endAt).getTime();
    }
    return timers;
  } catch (e) {
    return timers;
  }
};
