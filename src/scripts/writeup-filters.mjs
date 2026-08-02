export const matchesWriteupFilters = (item, filters) => (
  (filters.platform === "all" || item.platform === filters.platform)
  && (filters.os === "all" || item.os === filters.os)
);

export const initializeWriteupFilters = (documentRoot = document) => {
  const filters = documentRoot.querySelector(".filters");
  if (!filters || filters.dataset.initialized === "true") return;

  const rows = [...documentRoot.querySelectorAll(".content-row")];
  const empty = documentRoot.querySelector(".no-results");
  const state = { platform: "all", os: "all" };

  const applyFilters = () => {
    let visible = 0;
    rows.forEach((row) => {
      const matches = matchesWriteupFilters(row.dataset, state);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    if (empty) empty.hidden = visible > 0;
  };

  filters.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-filter-type]");
    if (!button) return;

    const type = button.dataset.filterType;
    if (type !== "platform" && type !== "os") return;

    state[type] = button.dataset.filter || "all";
    button.parentElement?.querySelectorAll("button").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });

  filters.dataset.initialized = "true";
};
