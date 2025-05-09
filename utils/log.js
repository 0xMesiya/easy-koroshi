import chalk from "chalk";

export const logAction = async (tokenId, action, extra = "") => {
  const time = chalk.gray(new Date().toLocaleString());
  const formatter = actionMap[action];
  const idPart = `${chalk.bold("ID:")} ${chalk.yellow(tokenId)}`;
  const arrow = chalk.gray("→");

  if (formatter) {
    console.log(`${time} ${arrow} ${idPart} ${arrow} ${formatter(extra)}`);
  } else {
    console.log(
      `${time} ${arrow} ${idPart} ${arrow} ${chalk.white(action)}${
        extra ? ` (${extra})` : ""
      }`
    );
  }
};

const actionMap = {
  TRAIN: () => chalk.magentaBright("Started Training 🏋️"),
  FIGHT: () => chalk.redBright("Entered Battle ⚔️"),
  LEVEL_UP: () => chalk.greenBright("Leveled Up ⬆️"),
};
