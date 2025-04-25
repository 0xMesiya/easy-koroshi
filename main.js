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

const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const nftBoxTitle = "NFT Status Table (Use ↑↓ to scroll, Tab to switch)";
const logBoxTitle = "Action Logs (↑↓ scroll, Tab to switch)";
const tableBox = grid.set(0, 0, 8, 12, contrib.table, {
  keys: true,
  vi: true, // allows hjkl navigation
  interactive: true,
  fg: "white",
  label: `${nftBoxTitle} [FOCUSED]`,
  columnWidth: [10, 12, 10, 20, 20, 20],
});

const logBox = grid.set(8, 0, 4, 12, blessed.list, {
  label: logBoxTitle,
  keys: true,
  vi: true,
  mouse: true,
  interactive: true,
  scrollable: true,
  alwaysScroll: true,
  border: "line",
  style: {
    fg: "green",
    selected: {
      bg: "yellow",
      fg: "black",
    },
    item: {
      hover: {
        bg: "gray",
      },
    },
    scrollbar: {
      bg: "yellow",
    },
  },
});

logBox.setScrollPerc(100);

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

screen.key(["escape", "q", "C-c"], () => process.exit(0));

let currentFocus = "table";
tableBox.focus();

// Allow switching focus with tab
screen.key(["tab"], () => {
  if (currentFocus === "table") {
    logBox.focus();
    currentFocus = "log";
    tableBox.setLabel(nftBoxTitle);
    logBox.setLabel(`${logBoxTitle} [FOCUSED]`);
  } else {
    tableBox.focus();
    currentFocus = "table";
    tableBox.setLabel(`${nftBoxTitle} [FOCUSED]`);
    logBox.setLabel(logBoxTitle);
  }

  screen.render();
});

const logAction = (tokenId, action) => {
  const time = new Date().toLocaleTimeString();
  const messages = {
    TRAIN: `Token ${tokenId} started training @ ${time}`,
    FIGHT: `Token ${tokenId} entered battle @ ${time}`,
    LEVEL_UP: `Token ${tokenId} leveled up @ ${time}`,
  };
  logBox.addItem(messages[action] || `Token ${tokenId} did: ${action}`);
  logBox.scrollTo(logBox.items.length - 1);
  screen.render();
};

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

const printStatusTable = async () => {
  const [nfts, tribes, activeTrainings, activeFights, activeLevelUps] =
    await Promise.all([
      getAllNfts(),
      getTribes(),
      getActiveTrainings(),
      getActiveFights(),
      getActiveLevelUps(),
    ]);

  const rows = [];

  for (const nft of nfts) {
    const nftId = nft.id;
    const myTribe = tribes.find((t) => t.id === nft.tribeId);
    const opponent = tribes.find(
      (t) => t.name === myTribe?.name && t.templeId !== myTribe?.templeId
    );

    rows.push([
      nft.tokenId,
      `${nft.xp}/${nft.requiredXp}`,
      `${nft.tribeFightsCount}/${nft.maxTribeFights}`,
      activeTrainings[nftId] ? formatDateTime(activeTrainings[nftId]) : "ready",
      activeFights[nftId] ? formatDateTime(activeFights[nftId]) : "ready",
      activeLevelUps[nftId]
        ? formatDateTime(activeLevelUps[nftId])
        : nft.xp >= nft.requiredXp
        ? "ready"
        : "waiting",
    ]);

    // Training
    const trainNow = async () => {
      const existingEnd = activeTrainings[nftId];
      if (existingEnd && existingEnd > Date.now())
        return scheduleAt(existingEnd + 1000, trainNow);
      const nextTrain = await trainNft(nftId);
      if (nextTrain) {
        logAction(nft.tokenId, "TRAIN");
        scheduleAt(nextTrain, trainNow);
        await printStatusTable();
      }
    };
    await trainNow();

    // Fight
    const fightLoop = async () => {
      if (nft.tribeFightsCount >= nft.maxTribeFights) return;
      const existingEnd = activeFights[nftId];
      if (existingEnd && existingEnd > Date.now())
        return scheduleAt(existingEnd + 1000, fightLoop);
      const nextFight = await fightNft(nftId, opponent.id);
      if (nextFight) {
        logAction(nft.tokenId, "FIGHT");
        scheduleAt(nextFight, fightLoop);
        await printStatusTable();
      }
    };
    await fightLoop();

    // Level up
    const levelNow = async () => {
      const existingEnd = activeLevelUps[nftId];
      if (existingEnd && existingEnd > Date.now())
        return scheduleAt(existingEnd + 1000, levelNow);
      if (nft.xp >= nft.requiredXp) {
        const levelEnd = await levelUpNft(nftId);
        if (levelEnd) {
          logAction(nft.tokenId, "LEVEL_UP");
          scheduleAt(levelEnd, levelNow);
          await printStatusTable();
        }
      }
    };
    await levelNow();
  }

  tableBox.setData({
    headers: ["Token", "XP", "Fights", "Training", "Fight", "LevelUp"],
    data: rows,
  });

  logBox.addItem(
    "Starting...Press Tab to switch focus between the table and logs."
  );

  screen.render();
};

// Kick it off
await printStatusTable();
