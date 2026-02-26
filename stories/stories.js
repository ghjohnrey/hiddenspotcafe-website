document.addEventListener("DOMContentLoaded", () => {
  // If the container isn't on this page, do nothing (prevents errors)
  const listEl = document.getElementById("stories-list");
  if (!listEl) return;

  // Optional search input (if you add <input id="q"> in your index.html)
  const qEl = document.getElementById("q");

  // Pagination controls (these should exist based on the index.html I gave)
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pageInfo = document.getElementById("pageInfo");

  const PAGE_SIZE = 10;

  let allStories = [];
  let filteredStories = [];

  // Read URL params (?page=2&q=keyword)
  const url = new URL(window.location.href);
  let page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  let query = (url.searchParams.get("q") || "").trim();

  if (qEl) qEl.value = query;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function setParams(newPage, newQuery) {
    const u = new URL(window.location.href);
    u.searchParams.set("page", String(newPage));
    if (newQuery) u.searchParams.set("q", newQuery);
    else u.searchParams.delete("q");
    window.history.replaceState({}, "", u.toString());
  }

  function matches(story, q) {
    if (!q) return true;
    const haystack = (
      (story.title || "") + " " +
      (story.excerpt || "") + " " +
      (Array.isArray(story.tags) ? story.tags.join(" ") : "")
    ).toLowerCase();
    return haystack.includes(q.toLowerCase());
  }

  function sortByNewest(a, b) {
    // If date is missing, treat as older
    const da = Date.parse(a.date || "1970-01-01");
    const db = Date.parse(b.date || "1970-01-01");
    return db - da;
  }

  function render() {
    filteredStories = allStories
      .filter(s => matches(s, query))
      .sort(sortByNewest);

    const totalPages = Math.max(1, Math.ceil(filteredStories.length / PAGE_SIZE));
    page = Math.min(page, totalPages);

    const start = (page - 1) * PAGE_SIZE;
    const items = filteredStories.slice(start, start + PAGE_SIZE);

    // Build cards
    listEl.innerHTML = "";

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="padding:16px;border:1px dashed rgba(255,255,255,0.25);border-radius:14px;">
          No stories found. Try another keyword.
        </div>
      `;
    } else {
      for (const s of items) {
        const tags = (s.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");
        const card = `
          <article class="story-card">
            <a class="story-link" href="${escapeHtml(s.url)}">
              <h2 class="story-title">${escapeHtml(s.title)}</h2>
            </a>
            <p class="story-excerpt">${escapeHtml(s.excerpt || "")}</p>
            <div class="story-meta">
              <span>⏱️ ${escapeHtml(s.readTime || "2 min")}</span>
              ${s.date ? `<span>📅 ${escapeHtml(s.date)}</span>` : ""}
            </div>
            <div class="story-tags">${tags}</div>
          </article>
        `;
        listEl.insertAdjacentHTML("beforeend", card);
      }
    }

    // Update pagination UI
    if (pageInfo) pageInfo.textContent = `${filteredStories.length} stories • Page ${page} of ${totalPages}`;

    if (prevBtn) {
      prevBtn.disabled = page <= 1;
      prevBtn.onclick = () => {
        page = Math.max(1, page - 1);
        setParams(page, query);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }

    if (nextBtn) {
      nextBtn.disabled = page >= totalPages;
      nextBtn.onclick = () => {
        page = Math.min(totalPages, page + 1);
        setParams(page, query);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  async function init() {
    try {
      // If you deploy at domain root, this is correct:
      const res = await fetch("/stories/stories.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stories.json");
      const data = await res.json();

      if (!Array.isArray(data)) throw new Error("stories.json must be an array");
      allStories = data;

      render();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `
        <div style="padding:16px;border:1px dashed rgba(255,255,255,0.25);border-radius:14px;">
          Error loading stories. Check that <code>/stories/stories.json</code> exists and is valid JSON.
        </div>
      `;
      if (pageInfo) pageInfo.textContent = "Error";
    }
  }

  if (qEl) {
    qEl.addEventListener("input", debounce(() => {
      query = qEl.value.trim();
      page = 1;
      setParams(page, query);
      render();
    }, 150));
  }

  init();
});