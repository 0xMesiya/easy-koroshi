import { getAllNfts } from "../api/fetchData.js";
import { getActiveTrainings } from "../api/status.js";

export const checkShouldTrain = async (nftId, resetTime) => {
  const now = new Date().getTime();
  const nfts = await getAllNfts();
  const freshNft = nfts.find((n) => n.id === nftId);
  // NO NFT FOUND
  if (!freshNft) {
    return {
      freshNft: freshNft,
      shouldTrain: false,
      scheduleFor: 0,
      reason: "NFT NO LONGER FOUND → STOPPING THIS TRAINING LOOP",
    };
  }

  const activeTrainings = await getActiveTrainings();
  const activeTrainingEnd = activeTrainings[nftId] || 0;

  // TRAINING IN PROGRESS
  if (activeTrainingEnd && activeTrainingEnd > now) {
    return {
      freshNft: freshNft,
      shouldTrain: false,
      scheduleFor: activeTrainingEnd + 1_000,
      reason: `TRAINING IN PROGRESS → NEXT SCHEDULED @ ${formatDateTime(
        activeTrainingEnd + 1_000
      )}`,
    };
  }

  return {
    freshNft: freshNft,
    shouldTrain: true,
    scheduleFor: 0,
    reason: `TRAIN`,
  };
};
