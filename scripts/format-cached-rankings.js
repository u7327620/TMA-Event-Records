const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const cachePath = path.join(repoRoot, "docs", "data", "index.json");

function loadCache() {
  return JSON.parse(fs.readFileSync(cachePath, "utf8"));
}

function comparePlayers(a, b) {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  if (a.losses !== b.losses) {
    return a.losses - b.losses;
  }
  if (a.draws !== b.draws) {
    return a.draws - b.draws;
  }
  return a.displayName.localeCompare(b.displayName);
}

function toLines(players) {
  return players
    .sort(comparePlayers)
    .map((player) => `${player.displayName}: ${player.wins}-${player.losses}-${player.draws || 0}`);
}

function main() {
  const cache = loadCache();
  const lines = toLines(cache.players);
  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
