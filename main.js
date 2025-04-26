import blessed from "blessed";
import contrib from "blessed-contrib";

import { getAllNfts, getInfo, getTribes } from "./api/fetchData.js";
import { fightNft } from "./api/fightNft.js";
import { levelUpNft } from "./api/levelUpNft.js";
import {
  getActiveFights,
  getActiveLevelUps,
  getActiveTrainings,
} from "./api/status.js";
import { trainNft } from "./api/trainNft.js";
import { scheduleAt } from "./utils/timer.js";
import { formatDateTime, logDateTime } from "./utils/utils.js";

const BACKOFF_INITIAL = 60_000; // 1 minute
const BACKOFF_MAX = 3_600_000; // 1 hour

// ─── UI Setup ─────────────────────────────────────────────────────────────────
const screen = blessed.screen();

const grid = new contrib.grid({ rows: 12, cols: 12, screen });

grid.set(0, 0, 1, 12, blessed.box, {
  label: "{bold}Koroshi Bot!{/bold}",
  border: "line",
  style: {
    border: { fg: "magenta" },
    bg: "black",
  },
  content:
    "{cyan-fg}Built by /0xMesiya{/cyan-fg} | {yellow-fg}DONATE: 0x8465305Fb28F3Ef16879c960e997Ad74689a2B3d{/yellow-fg}",
  tags: true,
});

const nftTableTitle = "NFT Status [↑↓ scroll, Tab to switch]";
const tableBox = grid.set(1, 0, 6, 12, contrib.table, {
  keys: false,
  vi: false,
  interactive: true,
  fg: "white",

  label: nftTableTitle,
  columnWidth: [6, 20, 20, 20, 20, 20],
});
const logsTitle = "Action Logs [↑↓ scroll, Tab to switch]";
const logBox = grid.set(7, 0, 5, 12, blessed.list, {
  label: `${logsTitle} [FOCUSED]`,
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

// Set initial logs
logBox.addItem(
  `{grey-fg}[${logDateTime(
    Date.now()
  )}]{/grey-fg}{green-fg} Koroshi Bot started...Fetching data and scheduling{/green-fg}`
);
logBox.scrollTo(logBox.items.length - 1);

// Key bindings
screen.key(["escape", "q", "C-c"], () => process.exit(0));

let currentFocus = "log";
logBox.focus();

// Allow switching focus with tab
screen.key(["tab"], () => {
  if (currentFocus === "table") {
    logBox.focus();
    currentFocus = "log";
    tableBox.setLabel(nftTableTitle);
    logBox.setLabel(`${logsTitle} [FOCUSED]`);
  } else {
    tableBox.focus();
    currentFocus = "table";
    tableBox.setLabel(`${nftTableTitle} [FOCUSED]`);
    logBox.setLabel(logsTitle);
  }

  screen.render();
});

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

const logAction = (tokenId, action, isError = false) => {
  const now = formatDateTime(Date.now());
  const texts = {
    TRAIN: `Token ${tokenId} → started training @ ${now}`,
    FIGHT: `Token ${tokenId} → started fight @ ${now}`,
    LEVEL_UP: `Token ${tokenId} → leveled up @ ${now}`,
  };
  let text = texts[action] || `Token ${tokenId} → ${action}`;
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

async function startLoopsForNFT(info, nft, tribes, at, af, al) {
  const nftId = nft.id;
  const resetTime = info.resetInterval.endAt;

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
        const nfts = await getAllNfts();
        const freshNft = nfts.find((n) => n.id === nftId);
        if (!freshNft) {
          logAction(tokenId, `NFT NO LONGER FOUND → STOPPING THIS FIGHT LOOP`);
          scheduledNFTs.delete(FIGHT_KEY);
          return;
        }

        if (freshNft.tribeFightsCount >= freshNft.maxTribeFights) {
          scheduleAt(resetTime + 1_000, fightLoop);
          return;
        }
        const next = await fightNft(nftId, opponent.id);
        logAction(tokenId, "FIGHT");
        redrawUI();
        fightBackoff = BACKOFF_INITIAL;
        scheduleAt(next + 1_000, fightLoop);
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

    if ((af[nftId] || 0) > now) {
      scheduleAt(af[nftId] + 1_000, fightLoop);
      logAction(
        tokenId,
        `FIGHTING IN PROGRESS → NEXT SCHEDULED @ ${formatDateTime(
          af[nftId] + 1_000
        )}`
      );
    } else {
      fightLoop();
    }
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

async function refreshUI() {
  const [info, nfts, tribes, at, af, al] = await Promise.all([
    getInfo(),
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
    await startLoopsForNFT(info, nft, tribes, at, af, al);
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
