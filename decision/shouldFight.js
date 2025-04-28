import { getAllNfts } from "../api/fetchData.js";
import { getActiveFights } from "../api/status.js";
import { formatDateTime } from "../utils/utils.js";

export const checkShouldFight = async (nftId, resetTime) => {
  const now = new Date().getTime();
  const nfts = await getAllNfts();
  const freshNft = nfts.find((n) => n.id === nftId);
  // NO NFT FOUND
  if (!freshNft) {
    return {
      freshNft: freshNft,
      shouldFight: false,
      scheduleFor: 0,
      reason: "NFT NO LONGER FOUND → STOPPING THIS FIGHT LOOP",
    };
  }

  // MAX FIGHTS REACHED
  if (freshNft.tribeFightsCount >= freshNft.maxTribeFights) {
    return {
      freshNft: freshNft,
      shouldFight: false,
      scheduleFor: resetTime + 1000,
      reason: `MAX FIGHTS REACHED → NEXT SCHEDULED @ ${formatDateTime(
        resetTime + 1000
      )}`,
    };
  }

  const activeFights = await getActiveFights();
  const activeFightEnd = activeFights[nftId] || 0;

  // FIGHT IN PROGRESS
  if (activeFightEnd && activeFightEnd > now) {
    return {
      freshNft: freshNft,
      shouldFight: false,
      scheduleFor: activeFightEnd + 1_000,
      reason: `FIGHT IN PROGRESS → NEXT SCHEDULED @ ${formatDateTime(
        activeFightEnd + 1_000
      )}`,
    };
  }

  // FIGHT NOW
  return {
    freshNft: freshNft,
    shouldFight: true,
    scheduleFor: 0,
    reason: `FIGHT`,
  };
};
