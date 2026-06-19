const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataRoot = path.join(repoRoot, "Data", "TFC");
const outputDir = path.join(repoRoot, "docs", "data");
const outputFile = path.join(outputDir, "index.json");

const COMMON_STAT_KEYS = [
  "Strikes Landed",
  "Strikes Thrown",
  "Accuracy",
  "Strikes Absorbed",
  "Strikes Defended",
  "Strike Defense Rate",
  "Knockdowns",
  "Striking Differential",
  "Takedowns Finished",
  "Takedowns Attempted",
  "Takedowns Defended",
  "Times Taken Down",
  "Takedown Accuracy",
  "Takedown Defense Rate",
  "Submissions Attempted",
  "Successful Submissions",
];

const DERIVED_PERCENT_KEYS = new Set([
  "Accuracy",
  "Strike Defense Rate",
  "Takedown Accuracy",
  "Takedown Defense Rate",
]);

function walkJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizePlayerId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+\d+$/, "")
    .toLowerCase();
}

function parseEventNumber(eventName) {
  const match = String(eventName || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function sanitizeResult(result) {
  return Array.isArray(result) ? result.filter(Boolean).map(String) : [];
}

function statBlockForPlayer(payload, playerKey) {
  if (!playerKey || typeof payload[playerKey] !== "object" || payload[playerKey] === null) {
    return {};
  }
  return payload[playerKey];
}

function extractPlayers(payload) {
  const reserved = new Set(["Meta", "Records", "Result", "Winner"]);
  const candidates = Object.keys(payload).filter((key) => !reserved.has(key));
  if (candidates.length <= 2) {
    return candidates;
  }

  const matchup = payload.Meta?.Name || "";
  if (!matchup.includes("_vs_")) {
    return candidates;
  }

  const [left, right] = matchup.split("_vs_", 2).map(normalizePlayerId);
  const matched = candidates.filter((key) => {
    const id = normalizePlayerId(key);
    return id === left || id === right;
  });

  return matched.length === 2 ? matched : candidates;
}

function createPlayerBucket(id, displayName) {
  return {
    id,
    displayName,
    totalFights: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    events: new Set(),
    statsAvailableFights: 0,
    statTotals: {},
    statCounts: {},
    bouts: [],
    latestEventNumber: 0,
  };
}

function createEventBucket(eventName, eventNumber) {
  return {
    id: String(eventName || "").toLowerCase(),
    event: eventName,
    eventNumber,
    totalBouts: 0,
    uniquePlayers: new Set(),
    winners: new Set(),
    statsAvailableBouts: 0,
    finishes: 0,
    methods: {},
    statTotals: {},
    statCounts: {},
    bouts: [],
  };
}

function addNumericStats(bucket, stats) {
  const entries = Object.entries(stats);
  if (!entries.length) {
    return false;
  }

  let sawNumber = false;
  for (const [key, value] of entries) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      continue;
    }
    if (DERIVED_PERCENT_KEYS.has(key)) {
      continue;
    }
    sawNumber = true;
    bucket.statTotals[key] = (bucket.statTotals[key] || 0) + value;
    bucket.statCounts[key] = (bucket.statCounts[key] || 0) + 1;
  }
  if (sawNumber) {
    bucket.statsAvailableFights += 1;
  }
  return sawNumber;
}

function preferredDisplayName(currentName, nextName, nextEventNumber, currentEventNumber) {
  if (!currentName) {
    return nextName;
  }
  if (nextEventNumber > currentEventNumber) {
    return nextName;
  }
  return currentName;
}

function summarizeResultLines(lines) {
  const descriptiveLine =
    lines.find((line) => /\bvia\b/i.test(line)) ||
    lines.find((line) => /refused to continue|doctor|stoppage|submission|knockout|forfeit/i.test(line)) ||
    lines.find((line) => !/\d{2}-\d{2}/.test(line) && line.toUpperCase() !== line && !/undocumented/i.test(line));
  const method = lines.find((line) => line.toUpperCase() === line) || "";
  return {
    summary: descriptiveLine || lines[0] || "Result unavailable",
    method: method || "UNKNOWN",
  };
}

function isDrawResult(lines, winnerId) {
  return !winnerId && lines.some((line) => String(line).trim().toUpperCase() === "DRAW");
}

function isNoContestResult(lines, winnerId) {
  return !winnerId && lines.some((line) => String(line).trim().toUpperCase() === "UNDOCUMENTED");
}

function addStatsToAggregate(target, stats) {
  let sawNumber = false;
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      continue;
    }
    if (DERIVED_PERCENT_KEYS.has(key)) {
      continue;
    }
    sawNumber = true;
    target.statTotals[key] = (target.statTotals[key] || 0) + value;
    target.statCounts[key] = (target.statCounts[key] || 0) + 1;
  }
  return sawNumber;
}

function deriveAggregateRates(totals) {
  const stats = { ...totals };

  if (typeof totals["Strikes Landed"] === "number" && typeof totals["Strikes Thrown"] === "number") {
    stats["Accuracy"] = totals["Strikes Thrown"] ? Number(((totals["Strikes Landed"] / totals["Strikes Thrown"]) * 100).toFixed(2)) : "N/A";
  }

  if (typeof totals["Takedowns Finished"] === "number" && typeof totals["Takedowns Attempted"] === "number") {
    stats["Takedown Accuracy"] = totals["Takedowns Attempted"]
      ? Number(((totals["Takedowns Finished"] / totals["Takedowns Attempted"]) * 100).toFixed(2))
      : "N/A";
  }

  if (typeof totals["Takedowns Defended"] === "number" || typeof totals["Times Taken Down"] === "number") {
    const defended = totals["Takedowns Defended"] || 0;
    const takenDown = totals["Times Taken Down"] || 0;
    stats["Takedown Defense Rate"] = defended + takenDown
      ? Number(((defended / (defended + takenDown)) * 100).toFixed(2))
      : "N/A";
  }

  if (typeof totals["Strikes Defended"] === "number" || typeof totals["Strikes Absorbed"] === "number") {
    const defended = totals["Strikes Defended"] || 0;
    const absorbed = totals["Strikes Absorbed"] || 0;
    stats["Strike Defense Rate"] = defended + absorbed
      ? Number(((defended / (defended + absorbed)) * 100).toFixed(2))
      : "N/A";
  }

  return stats;
}

function buildIndex() {
  const jsonFiles = walkJsonFiles(dataRoot);
  const players = new Map();
  const eventBuckets = new Map();
  const events = new Set();

  for (const filePath of jsonFiles) {
    const raw = fs.readFileSync(filePath, "utf8");
    const payload = JSON.parse(raw);
    const playerKeys = extractPlayers(payload);
    if (playerKeys.length !== 2) {
      continue;
    }

    const eventName = payload.Meta?.Event || path.basename(path.dirname(filePath));
    const eventNumber = parseEventNumber(eventName);
    const resultLines = sanitizeResult(payload.Result);
    const resultSummary = summarizeResultLines(resultLines);
    const winnerId = normalizePlayerId(payload.Winner);
    const draw = isDrawResult(resultLines, winnerId);
    const noContest = isNoContestResult(resultLines, winnerId);
    const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");

    events.add(eventName);
    if (!eventBuckets.has(eventName)) {
      eventBuckets.set(eventName, createEventBucket(eventName, eventNumber));
    }
    const eventBucket = eventBuckets.get(eventName);
    eventBucket.totalBouts += 1;
    eventBucket.methods[resultSummary.method] = (eventBucket.methods[resultSummary.method] || 0) + 1;
    if (resultSummary.method !== "DECISION" && resultSummary.method !== "UNKNOWN") {
      eventBucket.finishes += 1;
    }
    if (winnerId) {
      eventBucket.winners.add(winnerId);
    }

    const participants = playerKeys.map((playerKey) => {
      const id = normalizePlayerId(playerKey);
      const stats = statBlockForPlayer(payload, playerKey);
      return { id, key: playerKey, displayName: playerKey, stats };
    });

    let boutHasStats = false;
    for (const participant of participants) {
      eventBucket.uniquePlayers.add(participant.id);
      boutHasStats = addStatsToAggregate(eventBucket, participant.stats) || boutHasStats;
    }
    if (boutHasStats) {
      eventBucket.statsAvailableBouts += 1;
    }

    eventBucket.bouts.push({
      event: eventName,
      eventNumber,
      matchup: payload.Meta?.Name || path.basename(filePath, ".json"),
      fighters: participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        stats: participant.stats,
        outcome: noContest ? "No Contest" : draw ? "Draw" : participant.id === winnerId ? "Win" : "Loss",
      })),
      winnerId,
      isDraw: draw,
      isNoContest: noContest,
      summary: resultSummary.summary,
      method: resultSummary.method,
      source: relativePath,
      hasStats: boutHasStats,
    });
    if (resultSummary.method === "SUBMISSION") {
      eventBucket.statTotals["Successful Submissions"] = (eventBucket.statTotals["Successful Submissions"] || 0) + 1;
    }

    for (const participant of participants) {
      if (!players.has(participant.id)) {
        players.set(participant.id, createPlayerBucket(participant.id, participant.displayName));
      }

      const bucket = players.get(participant.id);
      bucket.displayName = preferredDisplayName(
        bucket.displayName,
        participant.displayName,
        eventNumber,
        bucket.latestEventNumber
      );
      bucket.latestEventNumber = Math.max(bucket.latestEventNumber, eventNumber);
      bucket.events.add(eventName);

      if (noContest) {
        // Keep the bout in history, but do not count undocumented winnerless fights in official record totals.
      } else {
        bucket.totalFights += 1;
      }

      if (noContest) {
        // no-op
      } else if (draw) {
        bucket.draws += 1;
      } else if (participant.id === winnerId) {
        bucket.wins += 1;
      } else {
        bucket.losses += 1;
      }

      addNumericStats(bucket, participant.stats);
      if (participant.id === winnerId && resultSummary.method === "SUBMISSION") {
        bucket.statTotals["Successful Submissions"] = (bucket.statTotals["Successful Submissions"] || 0) + 1;
      }

      const opponent = participants.find((entry) => entry.id !== participant.id);
      bucket.bouts.push({
        event: eventName,
        eventNumber,
        matchup: payload.Meta?.Name || path.basename(filePath, ".json"),
        opponentId: opponent.id,
        opponentName: opponent.displayName,
        outcome: noContest ? "No Contest" : draw ? "Draw" : participant.id === winnerId ? "Win" : "Loss",
        summary: resultSummary.summary,
        method: resultSummary.method,
        isDraw: draw,
        isNoContest: noContest,
        hasStats: Object.keys(participant.stats).length > 0,
        playerStats: participant.stats,
        opponentStats: opponent.stats,
        source: relativePath,
      });
    }
  }

  const playerList = Array.from(players.values())
    .map((bucket) => {
      const aggregateStats = deriveAggregateRates(bucket.statTotals);

      const featuredStats = {};
      for (const key of COMMON_STAT_KEYS) {
        if (key in aggregateStats) {
          featuredStats[key] = aggregateStats[key];
        }
      }

      bucket.bouts.sort((a, b) => b.eventNumber - a.eventNumber || a.opponentName.localeCompare(b.opponentName));
      bucket.winRate = bucket.totalFights ? Number(((bucket.wins / bucket.totalFights) * 100).toFixed(1)) : 0;

      return {
        id: bucket.id,
        displayName: bucket.displayName,
        totalFights: bucket.totalFights,
        wins: bucket.wins,
        losses: bucket.losses,
        draws: bucket.draws,
        winRate: bucket.winRate,
        events: Array.from(bucket.events).sort((a, b) => parseEventNumber(b) - parseEventNumber(a)),
        statsAvailableFights: bucket.statsAvailableFights,
        aggregateStats,
        featuredStats,
        bouts: bucket.bouts,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      return a.displayName.localeCompare(b.displayName);
    });

  const eventList = Array.from(eventBuckets.values())
    .map((bucket) => {
      const aggregateStats = deriveAggregateRates(bucket.statTotals);

      const featuredStats = {};
      for (const key of COMMON_STAT_KEYS) {
        if (key in aggregateStats) {
          featuredStats[key] = aggregateStats[key];
        }
      }

      bucket.bouts.sort((a, b) => a.matchup.localeCompare(b.matchup));

      return {
        id: bucket.id,
        event: bucket.event,
        eventNumber: bucket.eventNumber,
        totalBouts: bucket.totalBouts,
        uniquePlayers: bucket.uniquePlayers.size,
        winnerCount: bucket.winners.size,
        statsAvailableBouts: bucket.statsAvailableBouts,
        finishes: bucket.finishes,
        decisions: bucket.totalBouts - bucket.finishes,
        methods: bucket.methods,
        aggregateStats,
        featuredStats,
        bouts: bucket.bouts,
      };
    })
    .sort((a, b) => b.eventNumber - a.eventNumber);

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: jsonFiles.length,
    playerCount: playerList.length,
    eventCount: events.size,
    featuredStatKeys: COMMON_STAT_KEYS,
    events: eventList,
    players: playerList,
  };
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(buildIndex(), null, 2)}\n`);
console.log(`Wrote ${outputFile}`);
