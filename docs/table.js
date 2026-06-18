const state = {
  index: null,
  rows: [],
  sortKey: "wins",
  sortDirection: "desc",
};

const els = {
  playerCount: document.getElementById("table-player-count"),
  eventCount: document.getElementById("table-event-count"),
  search: document.getElementById("table-search"),
  eventFilter: document.getElementById("table-event-filter"),
  rowLimit: document.getElementById("table-row-limit"),
  status: document.getElementById("table-status"),
  tableHead: document.getElementById("stats-table-head"),
  tableBody: document.getElementById("stats-table-body"),
};

const BASE_COLUMNS = [
  { key: "displayName", label: "Player", type: "text" },
  { key: "wins", label: "Wins", type: "number" },
  { key: "losses", label: "Losses", type: "number" },
  { key: "winRate", label: "Win Rate", type: "percent" },
  { key: "totalFights", label: "Fights", type: "number" },
  { key: "eventsCount", label: "Events", type: "number" },
];

const MAX_STAT_EVENT_NUMBER = 22;

function parseEventNumber(eventName) {
  const match = String(eventName || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getStatColumns(index) {
  return index.featuredStatKeys.map((key) => ({
    key: `stat:${key}`,
    label: key,
    type: key.toLowerCase().includes("accuracy") || key.toLowerCase().includes("rate") ? "percent" : "number",
  }));
}

function getAllColumns() {
  return [...BASE_COLUMNS, ...getStatColumns(state.index)];
}

function formatValue(type, value) {
  if (type === "text") {
    return value;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  if (type === "percent") {
    return `${value.toFixed(1)}%`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getSortValue(row, key) {
  if (key.startsWith("stat:")) {
    const statKey = key.slice(5);
    const value = row.aggregateStats[statKey];
    return typeof value === "number" ? value : null;
  }
  return row[key];
}

function sortRows(rows) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = getSortValue(a, state.sortKey);
    const bValue = getSortValue(b, state.sortKey);

    if (aValue === null && bValue !== null) {
      return 1;
    }
    if (bValue === null && aValue !== null) {
      return -1;
    }
    if (aValue !== bValue) {
      if (typeof aValue === "string" || typeof bValue === "string") {
        return String(aValue).localeCompare(String(bValue)) * direction;
      }
      return (aValue - bValue) * direction;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function filterRows() {
  const query = els.search.value.trim().toLowerCase();
  const eventFilter = els.eventFilter.value;

  let rows = state.index.players.map((player) => ({
    ...player,
    eventsCount: player.events.length,
  }));

  if (query) {
    rows = rows.filter((row) => row.displayName.toLowerCase().includes(query) || row.id.includes(query));
  }

  if (eventFilter) {
    rows = rows.filter((row) => row.events.includes(eventFilter));
  }

  rows = sortRows(rows);

  const limit = Number(els.rowLimit.value);
  if (Number.isFinite(limit) && limit > 0) {
    rows = rows.slice(0, limit);
  }

  state.rows = rows;
}

function renderHead() {
  const columns = getAllColumns();
  const headerRow = columns
    .map((column) => {
      const isActive = column.key === state.sortKey;
      const direction = isActive ? (state.sortDirection === "asc" ? "↑" : "↓") : "";
      return `
        <th scope="col">
          <button class="table-sort${isActive ? " is-active" : ""}" type="button" data-sort-key="${column.key}">
            <span>${column.label}</span>
            <span class="table-sort-indicator">${direction}</span>
          </button>
        </th>
      `;
    })
    .join("");

  els.tableHead.innerHTML = `<tr>${headerRow}</tr>`;
}

function renderBody() {
  const columns = getAllColumns();
  els.tableBody.innerHTML = state.rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = column.key.startsWith("stat:")
            ? row.aggregateStats[column.key.slice(5)]
            : row[column.key];
          const displayValue = formatValue(column.type, value);
          const className = column.key === "displayName" ? "table-player-cell" : "table-number-cell";
          return `<td class="${className}">${displayValue}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const totalPlayers = state.index.players.length;
  els.status.textContent = `${state.rows.length} of ${totalPlayers} players shown`;
}

function renderTable() {
  filterRows();
  renderHead();
  renderBody();
}

function populateEventFilter() {
  const options = state.index.events
    .filter((eventItem) => parseEventNumber(eventItem.event) <= MAX_STAT_EVENT_NUMBER)
    .map((eventItem) => `<option value="${eventItem.event}">${eventItem.event}</option>`)
    .join("");
  els.eventFilter.insertAdjacentHTML("beforeend", options);
}

function attachEvents() {
  els.search.addEventListener("input", renderTable);
  els.eventFilter.addEventListener("change", renderTable);
  els.rowLimit.addEventListener("change", renderTable);

  els.tableHead.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sort-key]");
    if (!button) {
      return;
    }
    const nextKey = button.dataset.sortKey;
    if (state.sortKey === nextKey) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = nextKey;
      state.sortDirection = nextKey === "displayName" ? "asc" : "desc";
    }
    renderTable();
  });
}

async function loadIndex() {
  const response = await fetch("./data/index.json");
  if (!response.ok) {
    throw new Error(`Failed to load data index: ${response.status}`);
  }

  state.index = await response.json();
  els.playerCount.textContent = state.index.playerCount;
  els.eventCount.textContent = state.index.eventCount;
  populateEventFilter();
  attachEvents();
  renderTable();
}

loadIndex().catch((error) => {
  els.status.textContent = "Unable to load player table.";
  console.error(error);
});
