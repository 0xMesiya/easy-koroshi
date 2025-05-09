import { getAllNfts } from "../api/fetchData.js";

import {
  getActiveFights,
  getActiveLevelUps,
  getActiveTrainings,
} from "../api/status.js";
import { formatDateTime } from "../utils/utils.js";

export const checkShouldLevelUp = async (nftId, resetTime) => {
  const now = new Date().getTime();
  const nfts = await getAllNfts();
  const freshNft = nfts.find((n) => n.id === nftId);
  // NO NFT FOUND
  if (!freshNft) {
    return {
      freshNft: freshNft,
      shouldLevelUp: false,
      scheduleFor: 0,
      reason: "NFT NO LONGER FOUND → STOPPING THIS LEVEL UP LOOP",
    };
  }

  // TIMER IN PROGRESS
  const activeLevelUp = await getActiveLevelUps();
  const activeLevelUpEnd = activeLevelUp[nftId];
  if (activeLevelUpEnd && activeLevelUpEnd > now) {
    return {
      freshNft: freshNft,
      shouldLevelUp: false,
      scheduleFor: activeLevelUpEnd + 1_000,
      reason: `LEVEL UP IN PROGRESS → NEXT SCHEDULED @ ${formatDateTime(
        activeLevelUpEnd + 1_000
      )}`,
    };
  }

  // NOT ENOUGH XP
  if (freshNft.xp < freshNft.requiredXp) {
    const activeFights = await getActiveFights();
    const activeFightEnd = activeFights[nftId] || Number.MAX_VALUE;

    const activeTraining = await getActiveTrainings();
    const activeTrainingEnd = activeTraining[nftId] || Number.MAX_VALUE;

    const newScheduleTime =
      Math.min(resetTime, activeFightEnd, activeTrainingEnd) + 1000;

    return {
      freshNft: freshNft,
      shouldLevelUp: false,
      scheduleFor: newScheduleTime,
      reason: `NOT ENOUGH XP → NEXT SCHEDULED @ ${formatDateTime(
        newScheduleTime
      )}`,
    };
  }

  // LEVEL UP NOW
  return {
    freshNft: freshNft,
    shouldLevelUp: true,
    scheduleFor: 0,
    reason: `LEVEL_UP`,
  };
};
