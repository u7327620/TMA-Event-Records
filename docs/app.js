const state = {
  index: null,
  mode: "players",
  filteredItems: [],
  activePlayerId: "",
  activeEventId: "",
  activeBoutSource: "",
  playerSortMetric: "wins",
  playerSortOrder: "desc",
};

const els = {
  playerCount: document.getElementById("player-count"),
  eventCount: document.getElementById("event-count"),
  searchInput: document.getElementById("player-search"),
  clearSearch: document.getElementById("clear-search"),
  searchLabel: document.getElementById("search-label"),
  searchStatus: document.getElementById("search-status"),
  searchResults: document.getElementById("search-results"),
  playerFilters: document.getElementById("player-filters"),
  playerSortMetric: document.getElementById("player-sort-metric"),
  playerSortOrder: document.getElementById("player-sort-order"),
  modePlayers: document.getElementById("mode-players"),
  modeEvents: document.getElementById("mode-events"),
  emptyState: document.getElementById("empty-state"),
  playerView: document.getElementById("player-view"),
  eventView: document.getElementById("event-view"),
  playerName: document.getElementById("player-name"),
  playerRecord: document.getElementById("player-record"),
  playerEvents: document.getElementById("player-events"),
  metricFights: document.getElementById("metric-fights"),
  metricWins: document.getElementById("metric-wins"),
  metricLosses: document.getElementById("metric-losses"),
  metricDraws: document.getElementById("metric-draws"),
  metricWinRate: document.getElementById("metric-win-rate"),
  statsCaption: document.getElementById("stats-caption"),
  statsGrid: document.getElementById("stats-grid"),
  boutsList: document.getElementById("bouts-list"),
  boutDetail: document.getElementById("bout-detail"),
  boutDetailTitle: document.getElementById("bout-detail-title"),
  boutDetailMeta: document.getElementById("bout-detail-meta"),
  boutDetailGrid: document.getElementById("bout-detail-grid"),
  eventName: document.getElementById("event-name"),
  eventBouts: document.getElementById("event-bouts"),
  eventPlayers: document.getElementById("event-players"),
  eventMetricBouts: document.getElementById("event-metric-bouts"),
  eventMetricPlayers: document.getElementById("event-metric-players"),
  eventMetricFinishes: document.getElementById("event-metric-finishes"),
  eventMetricDecisions: document.getElementById("event-metric-decisions"),
  eventStatsCaption: document.getElementById("event-stats-caption"),
  eventStatsGrid: document.getElementById("event-stats-grid"),
  eventBoutsList: document.getElementById("event-bouts-list"),
};

const FEATURED_BOUT_STATS = ["Strikes Landed", "Accuracy", "Takedowns Finished", "Submissions Attempted"];

function readHashRoute() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (raw.startsWith("event=")) {
    return { type: "events", id: decodeURIComponent(raw.slice(6)).toLowerCase() };
  }
  if (raw.startsWith("player=")) {
    return { type: "players", id: decodeURIComponent(raw.slice(7)).toLowerCase() };
  }
  return null;
}

function formatStatValue(key, value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  const isPercent = key.toLowerCase().includes("accuracy") || key.toLowerCase().includes("rate");
  if (isPercent) {
    return `${value.toFixed(1)}%`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function updateMeta(index) {
  els.playerCount.textContent = index.playerCount;
  els.eventCount.textContent = index.eventCount;
}

function populatePlayerSortMetrics() {
  const options = [
    ["wins", "Wins"],
    ["losses", "Losses"],
    ["draws", "Draws"],
    ["winRate", "Win Rate"],
    ["totalFights", "Total Fights"],
    ...state.index.featuredStatKeys.map((key) => [`stat:${key}`, key]),
  ];

  els.playerSortMetric.innerHTML = options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  els.playerSortMetric.value = state.playerSortMetric;
}

function getPlayerMetricValue(player, metric) {
  if (metric === "wins" || metric === "losses" || metric === "draws" || metric === "winRate" || metric === "totalFights") {
    return player[metric];
  }

  if (metric.startsWith("stat:")) {
    const statKey = metric.slice(5);
    const value = player.aggregateStats[statKey];
    return typeof value === "number" ? value : null;
  }

  return 0;
}

function sortPlayers(players) {
  const direction = state.playerSortOrder === "asc" ? 1 : -1;
  const metric = state.playerSortMetric;

  return [...players].sort((a, b) => {
    const aValue = getPlayerMetricValue(a, metric);
    const bValue = getPlayerMetricValue(b, metric);
    if (aValue === null && bValue !== null) {
      return 1;
    }
    if (bValue === null && aValue !== null) {
      return -1;
    }
    if (aValue !== bValue) {
      return (aValue - bValue) * direction;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function formatPlayerMetricForList(player) {
  if (state.playerSortMetric.startsWith("stat:")) {
    const statKey = state.playerSortMetric.slice(5);
    return `${statKey}: ${formatStatValue(statKey, player.aggregateStats[statKey])}`;
  }

  if (state.playerSortMetric === "winRate") {
    return `Win Rate: ${player.winRate}%`;
  }

  if (state.playerSortMetric === "totalFights") {
    return `Total Fights: ${player.totalFights}`;
  }

  if (state.playerSortMetric === "wins") {
    return `Wins: ${player.wins}`;
  }

  if (state.playerSortMetric === "draws") {
    return `Draws: ${player.draws}`;
  }

  return `Losses: ${player.losses}`;
}

function getCollection() {
  return state.mode === "players" ? state.index.players : state.index.events;
}

function filterItems(query) {
  if (!state.index) {
    return [];
  }

  const trimmed = query.trim().toLowerCase();
  const collection = getCollection();

  if (!trimmed) {
    return state.mode === "players" ? sortPlayers(collection).slice(0, 18) : collection.slice(0, 23);
  }

  const filtered = collection.filter((item) => {
    if (state.mode === "players") {
      return item.displayName.toLowerCase().includes(trimmed) || item.id.includes(trimmed);
    }
    return item.event.toLowerCase().includes(trimmed) || item.id.includes(trimmed);
  });

  return state.mode === "players" ? sortPlayers(filtered) : filtered;
}

function itemIsActive(item) {
  return state.mode === "players" ? item.id === state.activePlayerId : item.id === state.activeEventId;
}

function resultMetaLine(item) {
  if (state.mode === "players") {
    return `${item.totalFights} fights across ${item.events.length} events`;
  }
  return `${item.totalBouts} bouts, ${item.uniquePlayers} players, ${item.finishes} finishes`;
}

function renderSearchResults() {
  els.searchResults.innerHTML = "";

  if (!state.filteredItems.length) {
    els.searchStatus.textContent = state.mode === "players" ? "No players matched that search." : "No TFC events matched that search.";
    return;
  }

  if (state.mode === "players") {
    els.searchStatus.textContent = els.searchInput.value.trim()
      ? `${state.filteredItems.length} matching players`
      : `${state.playerSortOrder === "desc" ? "Highest" : "Lowest"} ${els.playerSortMetric.selectedOptions[0].text.toLowerCase()}`;
  } else {
    els.searchStatus.textContent = els.searchInput.value.trim()
      ? `${state.filteredItems.length} matching TFC events`
      : "All TFC events, newest first";
  }

  const fragment = document.createDocumentFragment();
  for (const item of state.filteredItems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `result-item${itemIsActive(item) ? " is-active" : ""}`;
    button.dataset.itemId = item.id;
    button.innerHTML =
      state.mode === "players"
        ? `
          <div class="result-title">
            <span>${item.displayName}</span>
            <span>${item.wins}-${item.losses}-${item.draws}</span>
          </div>
          <div class="result-path">${resultMetaLine(item)}</div>
          <span class="result-subtitle">${formatPlayerMetricForList(item)}</span>
        `
        : `
          <div class="result-title">
            <span>${item.event}</span>
            <span>${item.totalBouts}</span>
          </div>
          <div class="result-path">${resultMetaLine(item)}</div>
        `;
    fragment.appendChild(button);
  }

  els.searchResults.appendChild(fragment);
}

function renderMetricGrid(container, captionEl, stats, statsAvailableCount, noun) {
  container.innerHTML = "";

  const entries = Object.entries(stats);
  if (!entries.length) {
    captionEl.textContent = `No stats were recorded for this ${noun}.`;
    const empty = document.createElement("div");
    empty.className = "metric-card compact";
    empty.innerHTML = `<span class="stats-empty">Stats unavailable in the source JSON files.</span>`;
    container.appendChild(empty);
    return;
  }

  captionEl.textContent = `Combined totals from ${statsAvailableCount} recorded ${noun}${statsAvailableCount === 1 ? "" : "s"}, with rate stats recalculated from those totals.`;

  const fragment = document.createDocumentFragment();
  for (const [key, value] of entries) {
    const card = document.createElement("article");
    card.className = "metric-card compact";
    card.innerHTML = `<span>${key}</span><strong>${formatStatValue(key, value)}</strong>`;
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}

function renderBoutDetail(player, bout) {
  const statKeys = Array.from(
    new Set([...Object.keys(bout.playerStats || {}), ...Object.keys(bout.opponentStats || {})])
  );

  els.boutDetail.classList.remove("hidden");
  els.boutDetailTitle.textContent = `${player.displayName} vs ${bout.opponentName}`;
  els.boutDetailMeta.textContent = `${bout.event} • ${bout.summary} • ${bout.method}`;

  const buildCard = (name, stats) => {
    if (!statKeys.length) {
      return `
        <article class="bout-detail-card">
          <h4>${name}</h4>
          <div class="bout-detail-stats">
            <div class="bout-detail-row">
              <span class="bout-detail-label">Stats</span>
              <strong>Unavailable</strong>
            </div>
          </div>
        </article>
      `;
    }

    const rows = statKeys
      .map((key) => {
        return `
          <div class="bout-detail-row">
            <span class="bout-detail-label">${key}</span>
            <strong>${formatStatValue(key, stats[key])}</strong>
          </div>
        `;
      })
      .join("");

    return `
      <article class="bout-detail-card">
        <h4>${name}</h4>
        <div class="bout-detail-stats">${rows}</div>
      </article>
    `;
  };

  els.boutDetailGrid.innerHTML = `${buildCard(player.displayName, bout.playerStats || {})}${buildCard(
    bout.opponentName,
    bout.opponentStats || {}
  )}`;
}

function clearBoutDetail() {
  state.activeBoutSource = "";
  els.boutDetail.classList.add("hidden");
  els.boutDetailGrid.innerHTML = "";
}

function renderPlayerBouts(player) {
  els.boutsList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const bout of player.bouts) {
    const statHtml = FEATURED_BOUT_STATS.map((key) => {
      return `<div class="bout-stat"><span>${key}</span><strong>${formatStatValue(key, bout.playerStats[key])}</strong></div>`;
    }).join("");

    const article = document.createElement("article");
    article.className = `bout-card${state.activeBoutSource === bout.source ? " is-active" : ""}`;
    article.dataset.boutSource = bout.source;
    article.innerHTML = `
      <div class="bout-topline">
        <div>
          <h4 class="bout-title">${player.displayName} vs ${bout.opponentName}</h4>
          <div class="bout-meta">
            <span>${bout.event}</span>
            <span>${bout.summary}</span>
          </div>
        </div>
        <span class="outcome ${bout.outcome.toLowerCase()}">${bout.outcome}</span>
      </div>
      <div class="bout-stats">${statHtml}</div>
      <div class="bout-meta">
        <span>${bout.method}</span>
        <span class="result-path">${bout.source}</span>
      </div>
    `;
    fragment.appendChild(article);
  }

  els.boutsList.appendChild(fragment);

  const activeBout = player.bouts.find((bout) => bout.source === state.activeBoutSource) || player.bouts[0];
  if (activeBout) {
    state.activeBoutSource = activeBout.source;
    renderBoutDetail(player, activeBout);
    for (const card of els.boutsList.querySelectorAll(".bout-card")) {
      card.classList.toggle("is-active", card.dataset.boutSource === activeBout.source);
    }
  } else {
    clearBoutDetail();
  }
}

function renderEventBouts(eventItem) {
  els.eventBoutsList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const bout of eventItem.bouts) {
    const [fighterA, fighterB] = bout.fighters;
    const statHtml = FEATURED_BOUT_STATS.map((key) => {
      const aValue = formatStatValue(key, fighterA?.stats[key]);
      const bValue = formatStatValue(key, fighterB?.stats[key]);
      return `
        <div class="bout-stat dual">
          <span>${key}</span>
          <strong>${fighterA?.displayName || "-"}: ${aValue}</strong>
          <strong>${fighterB?.displayName || "-"}: ${bValue}</strong>
        </div>
      `;
    }).join("");

    const article = document.createElement("article");
    article.className = "bout-card";
    article.innerHTML = `
      <div class="bout-topline">
        <div>
          <h4 class="bout-title">${fighterA.displayName} vs ${fighterB.displayName}</h4>
          <div class="bout-meta">
            <span>${bout.summary}</span>
            <span>${bout.method}</span>
          </div>
        </div>
        <span class="outcome ${bout.isDraw ? "draw" : "win"}">${
          bout.isDraw ? "Draw" : (bout.fighters.find((fighter) => fighter.id === bout.winnerId) || fighterA).displayName
        }</span>
      </div>
      <div class="bout-stats">${statHtml}</div>
      <div class="bout-meta">
        <span>${bout.matchup}</span>
        <span class="result-path">${bout.source}</span>
      </div>
    `;
    fragment.appendChild(article);
  }

  els.eventBoutsList.appendChild(fragment);
}

function renderPlayer(player) {
  state.activePlayerId = player.id;
  state.activeEventId = "";
  if (!player.bouts.some((bout) => bout.source === state.activeBoutSource)) {
    state.activeBoutSource = "";
  }
  window.location.hash = `player=${encodeURIComponent(player.id)}`;

  els.emptyState.classList.add("hidden");
  els.eventView.classList.add("hidden");
  els.playerView.classList.remove("hidden");
  els.playerName.textContent = player.displayName;
  els.playerRecord.textContent = `${player.wins}-${player.losses}-${player.draws}`;
  els.playerEvents.textContent = `${player.events.length} event${player.events.length === 1 ? "" : "s"}`;
  els.metricFights.textContent = player.totalFights;
  els.metricWins.textContent = player.wins;
  els.metricLosses.textContent = player.losses;
  els.metricDraws.textContent = player.draws;
  els.metricWinRate.textContent = `${player.winRate}%`;
  renderMetricGrid(els.statsGrid, els.statsCaption, player.featuredStats, player.statsAvailableFights, "fight");
  renderPlayerBouts(player);
  renderSearchResults();
}

function renderEvent(eventItem) {
  state.activeEventId = eventItem.id;
  state.activePlayerId = "";
  clearBoutDetail();
  window.location.hash = `event=${encodeURIComponent(eventItem.id)}`;

  els.emptyState.classList.add("hidden");
  els.playerView.classList.add("hidden");
  els.eventView.classList.remove("hidden");
  els.eventName.textContent = eventItem.event;
  els.eventBouts.textContent = `${eventItem.totalBouts} bouts`;
  els.eventPlayers.textContent = `${eventItem.uniquePlayers} players`;
  els.eventMetricBouts.textContent = eventItem.totalBouts;
  els.eventMetricPlayers.textContent = eventItem.uniquePlayers;
  els.eventMetricFinishes.textContent = eventItem.finishes;
  els.eventMetricDecisions.textContent = eventItem.decisions;
  renderMetricGrid(
    els.eventStatsGrid,
    els.eventStatsCaption,
    eventItem.featuredStats,
    eventItem.statsAvailableBouts,
    "bout"
  );
  renderEventBouts(eventItem);
  renderSearchResults();
}

function selectById(id) {
  if (!state.index) {
    return;
  }

  if (state.mode === "players") {
    const player = state.index.players.find((entry) => entry.id === id);
    if (player) {
      renderPlayer(player);
    }
    return;
  }

  const eventItem = state.index.events.find((entry) => entry.id === id);
  if (eventItem) {
    renderEvent(eventItem);
  }
}

function refreshSearch() {
  state.filteredItems = filterItems(els.searchInput.value);
  renderSearchResults();
}

function updateModeUi() {
  const isPlayers = state.mode === "players";
  els.modePlayers.classList.toggle("is-active", isPlayers);
  els.modeEvents.classList.toggle("is-active", !isPlayers);
  els.playerFilters.classList.toggle("hidden", !isPlayers);
  els.searchLabel.textContent = isPlayers ? "Find a player" : "Browse a TFC event";
  els.searchInput.placeholder = isPlayers ? "Search by player name" : "Search by TFC event";
}

function setMode(mode) {
  state.mode = mode;
  updateModeUi();
  refreshSearch();

  if (mode === "players") {
    if (state.activePlayerId) {
      selectById(state.activePlayerId);
      return;
    }
  } else if (state.activeEventId) {
    selectById(state.activeEventId);
    return;
  }

  const first = state.filteredItems[0];
  if (first) {
    selectById(first.id);
  }
}

async function loadIndex() {
  const response = await fetch("./data/index.json");
  if (!response.ok) {
    throw new Error(`Failed to load data index: ${response.status}`);
  }

  state.index = await response.json();
  updateMeta(state.index);
  populatePlayerSortMetrics();

  const route = readHashRoute();
  if (route) {
    state.mode = route.type;
  }

  updateModeUi();
  refreshSearch();

  if (route) {
    selectById(route.id);
    return;
  }

  const first = state.filteredItems[0];
  if (first) {
    selectById(first.id);
  }
}

els.searchInput.addEventListener("input", refreshSearch);
els.clearSearch.addEventListener("click", () => {
  els.searchInput.value = "";
  refreshSearch();
  els.searchInput.focus();
});
els.playerSortMetric.addEventListener("change", () => {
  state.playerSortMetric = els.playerSortMetric.value;
  refreshSearch();
});
els.playerSortOrder.addEventListener("change", () => {
  state.playerSortOrder = els.playerSortOrder.value;
  refreshSearch();
});

els.modePlayers.addEventListener("click", () => setMode("players"));
els.modeEvents.addEventListener("click", () => setMode("events"));

els.searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-item-id]");
  if (!button) {
    return;
  }
  selectById(button.dataset.itemId);
});

els.boutsList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-bout-source]");
  if (!card || !state.activePlayerId || !state.index) {
    return;
  }
  const player = state.index.players.find((entry) => entry.id === state.activePlayerId);
  if (!player) {
    return;
  }
  const bout = player.bouts.find((entry) => entry.source === card.dataset.boutSource);
  if (!bout) {
    return;
  }
  state.activeBoutSource = bout.source;
  renderPlayerBouts(player);
});

window.addEventListener("hashchange", () => {
  const route = readHashRoute();
  if (!route) {
    return;
  }
  state.mode = route.type;
  updateModeUi();
  refreshSearch();
  selectById(route.id);
});

loadIndex().catch((error) => {
  els.searchStatus.textContent = "Unable to load player data.";
  els.searchResults.innerHTML = "";
  console.error(error);
});
