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
  let baseOrder = []; // shuffled list for browsing
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

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function isNewToday(story) {
    if (!story || !story.date) return false;
    return story.date === todayISO();
  }

  function isTrending(story) {
    const tags = Array.isArray(story?.tags) ? story.tags : [];
    return tags.map(t => String(t).toLowerCase()).includes("trending");
  }

  // NOTE: uses story-badge (NOT .badge) to avoid conflict with your global .badge
  function badgesHTML(story) {
    const badges = [];
    if (isNewToday(story)) badges.push(`<span class="story-badge story-badge-new">🆕 NEW TODAY</span>`);
    if (isTrending(story)) badges.push(`<span class="story-badge story-badge-trending">🔥 TRENDING</span>`);
    if (!badges.length) return "";
    return `<div class="badge-row">${badges.join("")}</div>`;
  }

  function renderFeatured(story, isSearching) {
    if (!featuredEl) return;

    if (isSearching || !story) {
      featuredEl.innerHTML = "";
      return;
    }

    const tags = (story.tags || [])
      .slice(0, 3)
      .map(t => `<span class="tag">#${escapeHtml(t)}</span>`)
      .join(" ");

    featuredEl.innerHTML = `
      <a class="featured-card-link" href="${escapeHtml(story.url)}">
        <article class="featured-card">
          <div class="featured-kicker">
            <span class="featured-badge">✨ Featured Story</span>
            <span>⏱️ ${escapeHtml(story.readTime || "2 min")}${story.date ? ` • 📅 ${escapeHtml(story.date)}` : ""}</span>
          </div>

          ${badgesHTML(story)}

          <h2 class="featured-title">${escapeHtml(story.title)}</h2>
          <p class="featured-excerpt">${escapeHtml(story.excerpt || "")}</p>

          <div class="story-tags">${tags}</div>

          <div class="featured-actions">
            <span class="read-btn" aria-hidden="true">Read now →</span>
          </div>
        </article>
      </a>
    `;
  }

  function renderList(isSearching) {
    // Build list source:
    // - searching: filtered + newest
    // - browsing: filtered in baseOrder, excluding featured (no duplicate)
    let filtered = allStories.filter(s => matches(s, query));

    if (isSearching) {
      filtered = filtered.sort(sortByNewest);
    } else {
    const order = baseOrder.filter(s => matches(s, query));

// Only remove the featured story from the grid if the featured box exists on the page
const featuredIsVisible = !!featuredEl;

filtered = (featuredIsVisible && featured)
  ? order.filter(s => s.url !== featured.url)
  : order;
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
        const tags = (s.tags || [])
          .map(t => `<span class="tag">#${escapeHtml(t)}</span>`)
          .join(" ");

        listEl.insertAdjacentHTML("beforeend", `
          <a class="story-card-link" href="${escapeHtml(s.url)}">
            <article class="story-card">
              ${badgesHTML(s)}

              <h2 class="story-title">${escapeHtml(s.title)}</h2>
              <p class="story-excerpt">${escapeHtml(s.excerpt || "")}</p>

              <div class="story-meta">
                <span>⏱️ ${escapeHtml(s.readTime || "2 min")}</span>
                ${s.date ? `<span>📅 ${escapeHtml(s.date)}</span>` : ""}
              </div>

              <div class="story-tags">${tags}</div>
            </article>
          </a>
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
    renderFeatured(featured, isSearching);
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

      // browsing order: shuffled once per load (stable for pagination)
      baseOrder = shuffle([...allStories]);
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

      // if user cleared search, reshuffle + new featured
      if (!query) {
        baseOrder = shuffle([...allStories]);
        featured = pickFeaturedFrom(baseOrder);
      }

      render();
    }, 150));
  }

  init();
});
/* =========================================================
   STORY PAGE SEARCH (ADDED)
   ========================================================= */

(function(){

  // Detect if nasa story page
  if (!window.currentStorySlug) return;

  const currentSlug = window.currentStorySlug;
  const currentTags = window.currentStoryTags || [];

  let storiesData = [];

  function normalizeUrl(story){
    return story.url || `/stories/${story.slug}.html`;
  }

  function tagOverlap(tagsA, tagsB){
    return tagsA.filter(t => tagsB.includes(t)).length;
  }

  function getSuggestions(){
    let sameTag = storiesData
      .map(s => ({
        ...s,
        score: tagOverlap(s.tags || [], currentTags)
      }))
      .filter(s => s.score > 0)
      .sort((a,b)=>b.score-a.score);

    if (sameTag.length >= 2) return sameTag;

    let random = [...storiesData].sort(()=>0.5-Math.random());

    return [...sameTag, ...random];
  }

  function render(containerId, list){
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!list.length){
      el.innerHTML = `<div class="story-page-search-empty">No results found</div>`;
      return;
    }

    el.innerHTML = list.map(s => `
      <a class="story-page-search-result" href="${normalizeUrl(s)}">
        <div class="story-page-search-result-title">${s.title}</div>
        <div class="story-page-search-result-excerpt">${s.excerpt || ""}</div>
        <div class="story-page-search-result-meta">${s.readTime || ""}</div>
      </a>
    `).join("");
  }

  function search(q){
    q = q.toLowerCase();

    return storiesData.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.excerpt.toLowerCase().includes(q) ||
      (s.tags || []).join(" ").toLowerCase().includes(q)
    );
  }

  function bind(inputId, resultId){
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("input", ()=>{
      const q = input.value.trim();

      // TOP SEARCH = no suggestions
      if (!q && resultId === "storySearchTopResults"){
        document.getElementById(resultId).innerHTML = "";
        return;
      }

      // BOTTOM SEARCH = suggestions
      if (!q){
        render(resultId, getSuggestions().slice(0,2));
        return;
      }

      render(resultId, search(q).slice(0,5));
    });
  }

  async function init(){
    try{
      const res = await fetch("/stories/stories.json");
      const data = await res.json();

      storiesData = data.filter(s => s.slug !== currentSlug);

      // default suggestions (BOTTOM ONLY)
      render("storySearchBottomResults", getSuggestions().slice(0,2));

      bind("storySearchTop", "storySearchTopResults");
      bind("storySearchBottom", "storySearchBottomResults");

    }catch(e){
      console.error("Story search failed", e);
    }
  }

  init();

})();


/* =========================================================
   STATIC SUGGESTED STORY LINKS (APPENDED)
   - Renders real clickable internal links after bottom search
   - Uses stories.json as source
   - Excludes current story
   - Randomly selects up to 10 titles
   - Safe append: does not modify existing search system
   ========================================================= */

(function () {
  const suggestedListEl = document.getElementById("storySuggestedLinksList");
  if (!suggestedListEl) return;

  function normalizeStoryUrl(story) {
    return story.url || `/stories/${story.slug}.html`;
  }

  function getCurrentSlug() {
    if (window.currentStorySlug) return window.currentStorySlug;

    const path = window.location.pathname;
    return path
      .replace(/^\/stories\//, "")
      .replace(/\/$/, "")
      .replace(/\.html$/, "");
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  async function initSuggestedLinks() {
    try {
      const res = await fetch("/stories/stories.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stories.json");

      const stories = await res.json();
      if (!Array.isArray(stories)) throw new Error("stories.json must be an array");

      const currentSlug = getCurrentSlug();

      const filtered = stories.filter((story) => story.slug !== currentSlug);
      const selected = shuffle(filtered).slice(0, 10);

      if (!selected.length) {
        suggestedListEl.innerHTML = `
          <div class="story-suggested-link-empty">No suggested stories available right now.</div>
        `;
        return;
      }

      suggestedListEl.innerHTML = selected.map((story) => `
        <a class="story-suggested-link" href="${escapeHtml(normalizeStoryUrl(story))}">
          <div class="story-suggested-link-title">${escapeHtml(story.title || "Untitled Story")}</div>
        </a>
      `).join("");
    } catch (error) {
      console.error("Suggested stories failed", error);
      suggestedListEl.innerHTML = `
        <div class="story-suggested-link-empty">Suggested stories are unavailable right now.</div>
      `;
    }
  }

  initSuggestedLinks();
})();

/* =========================================================
   SEARCH RESULT OVERRIDE (APPENDED)
   - Makes top and bottom story search use title-only link results
   - Matches the Suggested Stories visual style
   - Shows random suggestions on bottom search when empty
   - Shows exact empty state:
     "No story found, try other terms."
   - Safe append: replaces the existing search inputs with cloned inputs
     so old listeners are removed without rewriting existing code
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  if (!window.currentStorySlug) return;

  function normalizeStoryUrl(story) {
    return story.url || `/stories/${story.slug}.html`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function matchesStory(story, query) {
    const q = query.toLowerCase().trim();
    if (!q) return true;

    const haystack = [
      story.title || "",
      story.excerpt || "",
      Array.isArray(story.tags) ? story.tags.join(" ") : ""
    ].join(" ").toLowerCase();

    return haystack.includes(q);
  }

  function renderTitleLinks(resultId, list) {
    const el = document.getElementById(resultId);
    if (!el) return;

    if (!list.length) {
      el.innerHTML = `
        <div class="story-suggested-link-empty">No story found, try other terms.</div>
      `;
      return;
    }

    el.innerHTML = list.map((story) => `
      <a class="story-suggested-link" href="${escapeHtml(normalizeStoryUrl(story))}">
        <div class="story-suggested-link-title">${escapeHtml(story.title || "Untitled Story")}</div>
      </a>
    `).join("");
  }

  function clearResults(resultId) {
    const el = document.getElementById(resultId);
    if (!el) return;
    el.innerHTML = "";
  }

  function cloneInputAndRemoveOldListeners(inputId) {
    const oldInput = document.getElementById(inputId);
    if (!oldInput || !oldInput.parentNode) return null;

    const newInput = oldInput.cloneNode(true);
    oldInput.parentNode.replaceChild(newInput, oldInput);
    return newInput;
  }

  async function initSearchOverride() {
    try {
      const res = await fetch("/stories/stories.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stories.json");

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("stories.json must be an array");

      const currentSlug = window.currentStorySlug;
      const storiesData = data.filter((story) => story.slug !== currentSlug);

      const topInput = cloneInputAndRemoveOldListeners("storySearchTop");
      const bottomInput = cloneInputAndRemoveOldListeners("storySearchBottom");

      if (!topInput && !bottomInput) return;

      function getRandomSuggestions(limit = 10) {
        return shuffle(storiesData).slice(0, limit);
      }

      function getSearchResults(query, limit = 10) {
        return storiesData.filter((story) => matchesStory(story, query)).slice(0, limit);
      }

      // TOP SEARCH
      if (topInput) {
        topInput.addEventListener("input", () => {
          const q = topInput.value.trim();

          if (!q) {
            clearResults("storySearchTopResults");
            return;
          }

          renderTitleLinks("storySearchTopResults", getSearchResults(q, 10));
        });
      }

      // BOTTOM SEARCH
if (bottomInput) {
  // empty by default because Suggested Stories already handles recommendations
  clearResults("storySearchBottomResults");

  bottomInput.addEventListener("input", () => {
    const q = bottomInput.value.trim();

    if (!q) {
      clearResults("storySearchBottomResults");
      return;
    }

    renderTitleLinks("storySearchBottomResults", getSearchResults(q, 10));
  });
}

    } catch (error) {
      console.error("Search override failed", error);
    }
  }

  initSearchOverride();
});
