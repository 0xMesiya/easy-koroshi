import { getAllNfts, getTribes } from "./api/fetchData.js";
import { fightNft } from "./api/fightNft.js";
import { levelUpNft } from "./api/levelUpNft.js";
import {
  getActiveFights,
  getActiveLevelUps,
  getActiveTrainings,
} from "./api/status.js";
import { trainNft } from "./api/trainNft.js";
import { scheduleAt } from "./utils/timer.js";

(async () => {
  const [nfts, tribes, activeTrainings, activeFights, activeLevelUps] =
    await Promise.all([
      getAllNfts(),
      getTribes(),
      getActiveTrainings(),
      getActiveFights(),
      getActiveLevelUps(),
    ]);

  const table = [];

  for (const nft of nfts) {
    const nftId = nft.id;
    const myTribe = tribes.find((t) => t.id === nft.tribeId);
    const opponent = tribes.find(
      (t) => t.name === myTribe?.name && t.templeId !== myTribe?.templeId
    );
    if (!opponent) continue;

    table.push({
      Token: nft.tokenId,
      XP: `${nft.xp}/${nft.requiredXp}`,
      Fights: `${nft.tribeFightsCount}/${nft.maxTribeFights}`,
      Training: activeTrainings[nftId]
        ? new Date(activeTrainings[nftId]).toLocaleTimeString("en-AU", {
            timeZone: "Australia/Brisbane",
          })
        : "ready",
      Fight: activeFights[nftId]
        ? new Date(activeFights[nftId]).toLocaleTimeString("en-AU", {
            timeZone: "Australia/Brisbane",
          })
        : "ready",
      LevelUp: activeLevelUps[nftId]
        ? new Date(activeLevelUps[nftId]).toLocaleTimeString("en-AU", {
            timeZone: "Australia/Brisbane",
          })
        : nft.xp >= nft.requiredXp
        ? "ready"
        : "waiting",
    });

    // === TRAINING ===
    const trainNow = async () => {
      const existingEnd = activeTrainings[nftId];
      if (existingEnd && existingEnd > Date.now())
        return scheduleAt(existingEnd + 1000, trainNow);
      const nextTrain = await trainNft(nftId);
      if (nextTrain) scheduleAt(nextTrain, trainNow);
    };
    await trainNow();

    // === FIGHTING ===
    const fightLoop = async () => {
      if (nft.tribeFightsCount >= nft.maxTribeFights) return;
      const existingEnd = activeFights[nftId];
      if (existingEnd && existingEnd > Date.now())
        return scheduleAt(existingEnd + 1000, fightLoop);
      const nextFight = await fightNft(nftId, opponent.id);
      if (nextFight) scheduleAt(nextFight, fightLoop);
    };
    await fightLoop();

    // === LEVEL UP ===
    const levelNow = async () => {
      const xp = nft.xp;
      const reqXp = nft.requiredXp;
      const existingEnd = activeLevelUps[nftId];
      if (existingEnd && existingEnd > Date.now())
        return scheduleAt(existingEnd + 1000, levelNow);
      if (xp >= reqXp) {
        const levelEnd = await levelUpNft(nftId);
        if (levelEnd) scheduleAt(levelEnd, levelNow);
      }
    };
    await levelNow();
  }
  console.table(table);
})();
