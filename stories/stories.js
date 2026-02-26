document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("stories-list");
  if (!listEl) return;

  const featuredEl = document.getElementById("featured-story"); // optional
  const qEl = document.getElementById("q");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pageInfo = document.getElementById("pageInfo");

  const PAGE_SIZE = 10;

  let allStories = [];
  let baseOrder = [];     // shuffled base order for browsing
  let featured = null;

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
    const da = Date.parse(a.date || "1970-01-01");
    const db = Date.parse(b.date || "1970-01-01");
    return db - da;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickFeaturedFrom(stories) {
    if (!stories.length) return null;
    const idx = Math.floor(Math.random() * stories.length);
    return stories[idx];
  }

  function renderFeatured(story, isSearching) {
    if (!featuredEl) return;

    // Hide featured while searching (cleaner UX)
    if (isSearching || !story) {
      featuredEl.innerHTML = "";
      return;
    }

    const tags = (story.tags || []).slice(0, 3).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");

    featuredEl.innerHTML = `
      <article class="featured-card">
        <div class="featured-kicker">
          <span class="featured-badge">✨ Featured Story</span>
          <span>⏱️ ${escapeHtml(story.readTime || "2 min")}${story.date ? ` • 📅 ${escapeHtml(story.date)}` : ""}</span>
        </div>

        <a class="story-link" href="${escapeHtml(story.url)}">
          <h2 class="featured-title">${escapeHtml(story.title)}</h2>
        </a>

        <p class="featured-excerpt">${escapeHtml(story.excerpt || "")}</p>

        <div class="story-tags">${tags}</div>

        <div class="featured-actions">
          <a class="read-btn" href="${escapeHtml(story.url)}">Read now →</a>
        </div>
      </article>
    `;
  }

  function renderList(isSearching) {
    // Build list source:
    // - searching: filtered + newest
    // - browsing: filtered in shuffled baseOrder, excluding featured (so no duplicate)
    let filtered = allStories.filter(s => matches(s, query));

    if (isSearching) {
      filtered = filtered.sort(sortByNewest);
    } else {
      const order = baseOrder.filter(s => matches(s, query));
      filtered = featured ? order.filter(s => s.url !== featured.url) : order;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, totalPages);

    const start = (page - 1) * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE);

    listEl.innerHTML = "";

    if (!items.length) {
      listEl.innerHTML = `
        <div style="padding:16px;border:1px dashed rgba(255,255,255,0.25);border-radius:14px;">
          No stories found. Try another keyword.
        </div>
      `;
    } else {
      for (const s of items) {
        const tags = (s.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");
        listEl.insertAdjacentHTML("beforeend", `
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
        `);
      }
    }

    if (pageInfo) pageInfo.textContent = `${filtered.length} stories • Page ${page} of ${totalPages}`;

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

  function render() {
    const isSearching = !!query;

    // Featured: only browsing (no query)
    renderFeatured(featured, isSearching);

    // List:
    renderList(isSearching);
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
      const res = await fetch("/stories/stories.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stories.json");
      const data = await res.json();

      if (!Array.isArray(data)) throw new Error("stories.json must be an array");
      allStories = data;

      // Random order for browsing (consistent across pagination)
      baseOrder = shuffle([...allStories]);

      // Pick featured from the randomized order (so it changes every load)
      featured = pickFeaturedFrom(baseOrder);

      render();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `
        <div style="padding:16px;border:1px dashed rgba(255,255,255,0.25);border-radius:14px;">
          Error loading stories. Check that <code>/stories/stories.json</code> exists and is valid JSON.
        </div>
      `;
      if (pageInfo) pageInfo.textContent = "Error";
      if (featuredEl) featuredEl.innerHTML = "";
    }
  }

  if (qEl) {
    qEl.addEventListener("input", debounce(() => {
      query = qEl.value.trim();
      page = 1;
      setParams(page, query);

      // If user clears search, refresh the random feed + new featured
      if (!query) {
        baseOrder = shuffle([...allStories]);
        featured = pickFeaturedFrom(baseOrder);
      }

      render();
    }, 150));
  }

  init();
});