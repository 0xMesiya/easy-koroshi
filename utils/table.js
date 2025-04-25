import { getAllNfts } from "../api/fetchData.js";
import {
  getActiveFights,
  getActiveLevelUps,
  getActiveTrainings,
} from "../api/status.js";

const formatDateTime = (timestamp) => {
  if (!timestamp) return "ready";
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString();
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${time} (${day})`;
};

export const printStatusTable = async () => {
  const [nfts, activeTrainings, activeFights, activeLevelUps] =
    await Promise.all([
      getAllNfts(),
      getActiveTrainings(),
      getActiveFights(),
      getActiveLevelUps(),
    ]);

  const table = [];

  for (const nft of nfts) {
    const nftId = nft.id;

    table.push({
      Token: nft.tokenId,
      XP: `${nft.xp}/${nft.requiredXp}`,
      Fights: `${nft.tribeFightsCount}/${nft.maxTribeFights}`,
      Training: activeTrainings[nftId]
        ? formatDateTime(activeTrainings[nftId])
        : "ready",
      Fight: activeFights[nftId]
        ? formatDateTime(activeFights[nftId])
        : "ready",
      LevelUp: activeLevelUps[nftId]
        ? formatDateTime(activeLevelUps[nftId])
        : nft.xp >= nft.requiredXp
        ? "ready"
        : "waiting",
    });
  }

  console.table(table);
};
