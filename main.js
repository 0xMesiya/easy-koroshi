import chalk from "chalk";
import { getAllNfts, getInfo, getTribes } from "./api/fetchData.js";
import { fightNft } from "./api/fightNft.js";
import { levelUpNft } from "./api/levelUpNft.js";
import {
  getActiveFights,
  getActiveLevelUps,
  getActiveTrainings,
} from "./api/status.js";
import { trainNft } from "./api/trainNft.js";
import { checkShouldFight } from "./decision/shouldFight.js";
import { printNFTTable } from "./utils/table.js";
import { scheduleAt } from "./utils/timer.js";
import { formatDateTime, logDateTime } from "./utils/utils.js";

const BACKOFF_INITIAL = 60_000; // 1 minute
const BACKOFF_MAX = 3_600_000; // 1 hour

// ─── Helpers ─────────────────────────────────────────────────────────────────
const error = chalk.red;
const log = chalk.green;

const logAction = (tokenId, action, isError = false) => {
  const now = formatDateTime(Date.now());
  const texts = {
    TRAIN: `Token ${tokenId} → started training @ ${now}`,
    FIGHT: `Token ${tokenId} → started fight @ ${now}`,
    LEVEL_UP: `Token ${tokenId} → leveled up @ ${now}`,
  };
  let text = texts[action] || `Token ${tokenId} → ${action}`;
  text = isError ? error(`[ERROR] ${text}`) : log(text);
  console.log(chalk.grey(`[${logDateTime(Date.now())}] ${text}`));
};

// ─── Scheduling Loops ─────────────────────────────────────────────────────────

// Keep track so we only schedule each NFT once
const scheduledNFTs = new Set();

async function startLoopsForNFT(info, nft, tribes, at, af, al) {
  const nftId = nft.id;
  const resetTime = new Date(info.resetInterval.endAt).getTime();

  const now = Date.now();
  const tokenId = nft.tokenId;
  const myTribe = tribes.find((t) => t.id === nft.tribeId);
  const opponent = tribes.find(
    (t) => t.name === myTribe?.name && t.templeId !== myTribe?.templeId
  );
  if (!opponent) return;

  // TRAIN loop
  const TRAIN_KEY = `${nftId}-TRAIN`;
  if (!scheduledNFTs.has(TRAIN_KEY)) {
    scheduledNFTs.add(TRAIN_KEY);
    let trainBackoff = BACKOFF_INITIAL;

    const trainLoop = async () => {
      try {
        const nfts = await getAllNfts();
        const freshNft = nfts.find((n) => n.id === nftId);
        if (!freshNft) {
          logAction(
            tokenId,
            `NFT NO LONGER FOUND → STOPPING THIS TRAINING LOOP`
          );
          scheduledNFTs.delete(TRAIN_KEY);
          return;
        }
        const next = await trainNft(nftId);
        logAction(tokenId, "TRAIN");
        trainBackoff = BACKOFF_INITIAL; // reset on success
        scheduleAt(next, trainLoop);
      } catch (err) {
        // schedule retry with backoff
        const when = Date.now() + trainBackoff;
        scheduleAt(when, trainLoop);
        trainBackoff = Math.min(trainBackoff * 2, BACKOFF_MAX);
        logAction(
          tokenId,
          `TRAINING FAILED → RETRYING @ ${formatDateTime(when)}`,
          true
        );
      }
    };

    if ((at[nftId] || 0) > now) {
      scheduleAt(at[nftId] + 1_000, trainLoop);
      logAction(
        tokenId,
        `TRAINING IN PROGRESS → NEXT SCHEDULED @ ${formatDateTime(
          at[nftId] + 1_000
        )}`
      );
    } else {
      trainLoop();
    }
  }

  // FIGHT loop
  const FIGHT_KEY = `${nftId}-FIGHT`;
  if (!scheduledNFTs.has(FIGHT_KEY)) {
    scheduledNFTs.add(FIGHT_KEY);
    let fightBackoff = BACKOFF_INITIAL;

    const fightLoop = async () => {
      try {
        const { freshNft, shouldFight, scheduleFor, reason } =
          await checkShouldFight(nftId, resetTime);

        if (!freshNft) {
          logAction(tokenId, reason);
          scheduledNFTs.delete(FIGHT_KEY);
          console.log("from !freshNft");
          await redrawUI();
          return;
        }

        if (!shouldFight) {
          logAction(tokenId, reason);
          scheduleAt(scheduleFor, fightLoop);
          return;
        }

        if (scheduleFor <= now) {
          const next = await fightNft(nftId, opponent.id);
          logAction(tokenId, reason);
          fightBackoff = BACKOFF_INITIAL; // reset on success
          scheduleAt(next + 1000, fightLoop);
          await redrawUI();
          console.log("from scheduleFor <= now");
        }
      } catch (err) {
        // schedule retry with backoff
        const when = Date.now() + fightBackoff;
        scheduleAt(when, fightLoop);
        fightBackoff = Math.min(fightBackoff * 2, BACKOFF_MAX);
        logAction(
          tokenId,
          `FIGHTING FAILED - RETRYING @ ${formatDateTime(when)}`,
          true
        );
      }
    };
    fightLoop();
  }

  // LEVEL-UP loop
  const LEVEL_KEY = `${nftId}-LEVEL_UP`;
  if (!scheduledNFTs.has(LEVEL_KEY)) {
    scheduledNFTs.add(LEVEL_KEY);
    let levelBackoff = BACKOFF_INITIAL;

    const levelLoop = async () => {
      try {
        const nfts = await getAllNfts();
        const freshNft = nfts.find((n) => n.id === nftId);
        if (!freshNft) {
          logAction(
            tokenId,
            `NFT NO LONGER FOUND → STOPPING THIS LEVEL UP LOOP`
          );
          scheduledNFTs.delete(LEVEL_KEY);
          return;
        }
        if (freshNft.xp < freshNft.requiredXp) {
          scheduledNFTs.delete(`${nftId}-LEVEL_UP`);
          // removed the log because this is checked a lot and it was spamming
          return;
        }
        const next = await levelUpNft(nftId);
        logAction(tokenId, "LEVEL_UP");
        levelBackoff = BACKOFF_INITIAL;
        scheduleAt(next, levelLoop);
      } catch (err) {
        const when = Date.now() + levelBackoff;
        scheduleAt(when, levelLoop);
        levelBackoff = Math.min(levelBackoff * 2, BACKOFF_MAX);
        logAction(
          tokenId,
          `LEVEL UP FAILED - RETRYING @ ${formatDateTime(when)}`,
          true
        );
      }
    };

    if ((al[nftId] || 0) > now) {
      scheduleAt(al[nftId] + 1_000, levelLoop);
      logAction(
        tokenId,
        `LEVEL UP TIMER IN PROGRESS → NEXT SCHEDULED @ ${formatDateTime(
          al[nftId] + 1_000
        )}`
      );
    } else {
      levelLoop();
    }
  }
}

// ─── UI Refresh ───────────────────────────────────────────────────────────────
const initialUI = () => {
  console.clear();
  console.log(
    chalk.magenta(
      `
  _  ______  _____   ____   _____ _    _ _____   ____   ____ _______ 
 | |/ / __ \\|  __ \\ / __ \\ / ____| |  | |_   _| |  _ \\ / __ \\__   __|
 | ' / |  | | |__) | |  | | (___ | |__| | | |   | |_) | |  | | | |   
 |  <| |  | |  _  /| |  | |\\___ \\|  __  | | |   |  _ <| |  | | | |   
 | . \\ |__| | | \\ \\| |__| |____) | |  | |_| |_  | |_) | |__| | | |   
 |_|\\_\\____/|_|  \\_\\\\____/|_____/|_|  |_|_____| |____/ \\____/  |_|   
                                                                     
`
    )
  );
  console.log(
    chalk.yellow(
      `\nBuilt by @0xMesiya, donations welcome to 0x8465305Fb28F3Ef16879c960e997Ad74689a2B3d\n`
    )
  );
};

async function refreshUI() {
  const [info, nfts, tribes, at, af, al] = await Promise.all([
    getInfo(),
    getAllNfts(),
    getTribes(),
    getActiveTrainings(),
    getActiveFights(),
    getActiveLevelUps(),
  ]);

  // schedule loops for any new NFTs
  for (const nft of nfts) {
    await startLoopsForNFT(info, nft, tribes, at, af, al);
  }
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
// only updates the table & logBox (no scheduling, no recursion)
const redrawUI = async () => {
  const [info, nfts, at, af, al] = await Promise.all([
    getInfo(),
    getAllNfts(),
    getActiveTrainings(),
    getActiveFights(),
    getActiveLevelUps(),
  ]);

  const resetTime = new Date(info.resetInterval.endAt).getTime();

  // rebuild table data
  printNFTTable(
    nfts.map((nft) => ({
      tokenId: nft.tokenId,
      levelXp: `${nft.level} (${nft.xp}/${nft.requiredXp})`,
      fights: `${nft.tribeFightsCount}/${nft.maxTribeFights}`,
      nextTraining: at[nft.id]
        ? formatDateTime(at[nft.id] + 1000)
        : formatDateTime(resetTime + 1000),
      nextFight:
        !(nft.tribeFightsCount >= nft.maxTribeFights) && af[nft.id]
          ? formatDateTime(af[nft.id] + 1000)
          : formatDateTime(resetTime + 1000),
      nextLevelUp: al[nft.id]
        ? formatDateTime(al[nft.id] + 1000)
        : nft.xp >= nft.requiredXp
        ? "READY"
        : "AVAILABLE | NEED XP",
    }))
  );
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
(async () => {
  initialUI();
  await redrawUI(); // initial draw
  await refreshUI(); // schedule loops
  setInterval(refreshUI, 60000); // update table every 60s, dont need this but it is a fallback
})();
