import chalk from "chalk";

export const printNFTTable = (nfts) => {
  console.log("\n");
  console.log(chalk.bold.cyan("=== NFT STATUS ==="));
  console.log(
    chalk.bold(
      `${pad("Token", 8)} ${pad("Level (XP)", 18)} ${pad("Fights", 12)} ${pad(
        "Next Training",
        20
      )} ${pad("Next Fight", 20)} ${pad("Next Level Up", 20)}`
    )
  );
  console.log(chalk.gray("-".repeat(98)));

  for (const nft of nfts) {
    console.log(
      `${pad(nft.tokenId, 8)} ${pad(nft.levelXp, 18)} ${pad(
        nft.fights,
        12
      )} ${pad(nft.nextTraining, 20)} ${pad(nft.nextFight, 20)} ${pad(
        nft.nextLevelUp,
        20
      )}`
    );
  }

  console.log("\n");
};

const pad = (text, width) => {
  text = String(text);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
};
