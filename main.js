// main.js
import blessed from "blessed";
import contrib from "blessed-contrib";

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

const BACKOFF_INITIAL = 60_000; // 1 minute
const BACKOFF_MAX = 3_600_000; // 1 hour

// ─── UI Setup ─────────────────────────────────────────────────────────────────
const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const nftTableTitle = "NFT Status";
const tableBox = grid.set(0, 0, 8, 12, contrib.table, {
  keys: false,
  vi: false,
  interactive: false,
  fg: "white",

  label: nftTableTitle,
  columnWidth: [10, 12, 10, 20, 20, 20],
});
const logsTitle = "Action Logs [↑↓ scroll]";
const logBox = grid.set(8, 0, 4, 12, blessed.list, {
  label: logsTitle,
  keys: true,
  vi: true,
  mouse: true,
  interactive: true,
  scrollable: true,
  alwaysScroll: true,
  tags: true,
  border: "line",
  style: {
    fg: "green",
    bg: "black",
    selected: { bg: "grey" },
    item: { hover: { bg: "grey" } },
    scrollbar: { bg: "blue" },
  },
});

// Key bindings
screen.key(["escape", "q", "C-c"], () => process.exit(0));

logBox.focus();

// scroll keys for logBox
logBox.key(["up", "k"], () => {
  logBox.scroll(-1);
  screen.render();
});
logBox.key(["down", "j"], () => {
  logBox.scroll(1);
  screen.render();
});
logBox.key(["pageup"], () => {
  logBox.scroll(-10);
  screen.render();
});
logBox.key(["pagedown"], () => {
  logBox.scroll(10);
  screen.render();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateTime = (ts) => {
  if (!ts) return "ready";
  const d = new Date(ts),
    t = d.toLocaleTimeString(),
    day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${t} (${day})`;
};

const logDateTime = (ts) =>
  new Date(ts).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const logAction = (tokenId, action, isError = false) => {
  const now = formatDateTime(Date.now());
  const texts = {
    TRAIN: `Token ${tokenId} → started training @ ${now}`,
    FIGHT: `Token ${tokenId} → started fight @ ${now}`,
    LEVEL_UP: `Token ${tokenId} → leveled up @ ${now}`,
  };
  let text = `${texts[action]}` || `Token ${tokenId} → ${action}`;
  if (isError) {
    text = `{red-fg}[ERROR] ${text}{/red-fg}`;
  }
  logBox.addItem(`{grey-fg}[${logDateTime(Date.now())}]{/grey-fg} ${text}`);
  logBox.scrollTo(logBox.items.length - 1);
  screen.render();
};

// ─── Scheduling Loops ─────────────────────────────────────────────────────────

// Keep track so we only schedule each NFT once
const scheduledNFTs = new Set();

async function startLoopsForNFT(nft, tribes, at, af, al) {
  const nftId = nft.id;

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
        const next = await trainNft(nftId);
        logAction(tokenId, "TRAIN");
        redrawUI();
        trainBackoff = BACKOFF_INITIAL; // reset on success
        scheduleAt(next, trainLoop);
      } catch (err) {
        // schedule retry with backoff
        const when = Date.now() + trainBackoff;
        scheduleAt(when, trainLoop);
        trainBackoff = Math.min(trainBackoff * 2, BACKOFF_MAX);
        logAction(
          tokenId,
          `TRAINING FAILED - RETRYING @ ${formatDateTime(when)}`,
          true
        );
      }
    };

    if ((at[nftId] || 0) > now) scheduleAt(at[nftId] + 1_000, trainLoop);
    else trainLoop();
  }

  // FIGHT loop
  const FIGHT_KEY = `${nftId}-FIGHT`;
  if (!scheduledNFTs.has(FIGHT_KEY)) {
    scheduledNFTs.add(FIGHT_KEY);
    let fightBackoff = BACKOFF_INITIAL;

    const fightLoop = async () => {
      try {
        if (nft.tribeFightsCount >= nft.maxTribeFights) return;
        const next = await fightNft(nftId, opponent.id);
        logAction(tokenId, "FIGHT");
        redrawUI();
        fightBackoff = BACKOFF_INITIAL;
        scheduleAt(next, fightLoop);
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

    if ((af[nftId] || 0) > now) scheduleAt(af[nftId] + 1_000, fightLoop);
    else fightLoop();
  }

  // LEVEL-UP loop
  const LEVEL_KEY = `${nftId}-LEVEL_UP`;
  if (!scheduledNFTs.has(LEVEL_KEY)) {
    scheduledNFTs.add(LEVEL_KEY);
    let levelBackoff = BACKOFF_INITIAL;

    const levelLoop = async () => {
      try {
        if (nft.xp < nft.requiredXp) return;
        const next = await levelUpNft(nftId);
        logAction(tokenId, "LEVEL_UP");
        redrawUI();
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

    if ((al[nftId] || 0) > now) scheduleAt(al[nftId] + 1_000, levelLoop);
    else levelLoop();
  }
}

// ─── UI Refresh ───────────────────────────────────────────────────────────────

async function refreshUI() {
  const [nfts, tribes, at, af, al] = await Promise.all([
    getAllNfts(),
    getTribes(),
    getActiveTrainings(),
    getActiveFights(),
    getActiveLevelUps(),
  ]);

  // rebuild table
  const data = nfts.map((nft) => {
    return [
      nft.tokenId,
      `${nft.level} (${nft.xp}/${nft.requiredXp})`,
      `${nft.tribeFightsCount}/${nft.maxTribeFights}`,
      at[nft.id] ? formatDateTime(at[nft.id]) : "ready",
      af[nft.id] ? formatDateTime(af[nft.id]) : "ready",
      al[nft.id]
        ? formatDateTime(al[nft.id])
        : nft.xp >= nft.requiredXp
        ? "ready"
        : "available | need XP",
    ];
  });

  tableBox.setData({
    headers: [
      "Token",
      "Lvl (XP)",
      "Fights",
      "Next Training",
      "Next Fight",
      "Next Level Up",
    ],
    data,
  });

  // schedule loops for any new NFTs
  for (const nft of nfts) {
    await startLoopsForNFT(nft, tribes, at, af, al);
  }

  screen.render();
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
// only updates the table & logBox (no scheduling, no recursion)
async function redrawUI() {
  const [nfts, at, af, al] = await Promise.all([
    getAllNfts(),
    getActiveTrainings(),
    getActiveFights(),
    getActiveLevelUps(),
  ]);

  // rebuild table data
  const rows = nfts.map((nft) => [
    nft.tokenId,
    `${nft.level} (${nft.xp}/${nft.requiredXp})`,
    `${nft.tribeFightsCount}/${nft.maxTribeFights}`,
    at[nft.id] ? formatDateTime(at[nft.id]) : "ready",
    af[nft.id] ? formatDateTime(af[nft.id]) : "ready",
    al[nft.id]
      ? formatDateTime(al[nft.id])
      : nft.xp >= nft.requiredXp
      ? "ready"
      : "available | need XP",
  ]);

  tableBox.setData({
    headers: [
      "Token",
      "Lvl (XP)",
      "Fights",
      "Next Training",
      "Next Fight",
      "Next Level Up",
    ],
    data: rows,
  });

  screen.render();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
(async () => {
  await refreshUI(); // initial draw + schedule loops
  setInterval(refreshUI, 60000); // update table every 60s, dont need this but it is a fallback
})();
