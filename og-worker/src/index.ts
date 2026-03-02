import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";

const STORIES_JSON_URL = "https://hiddenspotcafe.com/stories/stories.json";
const SITE_LABEL = "Hidden Spot Cafe";

// In production, assets are under the /og/* route
const FONT_REG_PATH = "/og/fonts/Inter_18pt-Regular.ttf";
const FONT_BOLD_PATH = "/og/fonts/Inter_18pt-Bold.ttf";

type Story = {
  slug?: string;
  title?: string;
  excerpt?: string;
  ogQuote?: string;
  description?: string;
};

/* -----------------------------
   1) resvg WASM init
----------------------------- */
let wasmInit: Promise<void> | null = null;

async function ensureWasm() {
  if (!wasmInit) {
    wasmInit = initWasm(wasmModule as unknown as WebAssembly.Module);
  }
  await wasmInit;
}

/* -----------------------------
   2) Helper functions
----------------------------- */
function escapeXml(str = ""): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const next = current ? `${current} ${w}` : w;

    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w;

      if (lines.length >= maxLines - 1) break;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);

  // Add ellipsis if truncated
  const usedWords = lines.join(" ").split(/\s+/).length;
  if (usedWords < words.length && lines.length) {
    lines[lines.length - 1] =
      lines[lines.length - 1].replace(/[.?!…]*$/, "") + "…";
  }

  return lines;
}

/* -----------------------------
   3) Fetch story by slug
----------------------------- */
async function getStoryBySlug(slug: string): Promise<Story | null> {
  const res = await fetch(STORIES_JSON_URL, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!res.ok) return null;

  const data: any = await res.json();
  const stories: Story[] = Array.isArray(data) ? data : data?.stories || [];
  return stories.find((s) => s.slug === slug) || null;
}

/* -----------------------------
   4) Load font BYTES and pass to Resvg (THIS FIXES "NO TEXT")
   IMPORTANT:
   - We do NOT rely on @font-face inside SVG.
   - We pass fontBuffers to Resvg.
----------------------------- */
let fontBytesCache: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null =
  null;

async function ensureFontBytes(origin: string) {
  if (!fontBytesCache) {
    fontBytesCache = (async () => {
      const regUrl = `${origin}${FONT_REG_PATH}`;
      const boldUrl = `${origin}${FONT_BOLD_PATH}`;

      const [regRes, boldRes] = await Promise.all([
        fetch(regUrl, { cf: { cacheTtl: 86400, cacheEverything: true } }),
        fetch(boldUrl, { cf: { cacheTtl: 86400, cacheEverything: true } }),
      ]);

      if (!regRes.ok) throw new Error(`Font regular fetch failed (${regRes.status})`);
      if (!boldRes.ok) throw new Error(`Font bold fetch failed (${boldRes.status})`);

      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);

      return {
        regular: new Uint8Array(regBuf),
        bold: new Uint8Array(boldBuf),
      };
    })();
  }

  return fontBytesCache;
}

/* -----------------------------
   5) SVG builder (no @font-face)
   - Just reference font-family "Inter"
   - Resvg will use the passed fontBuffers
----------------------------- */
function buildSvg(opts: { title: string; quote: string; site: string }): string {
  const safeTitle = escapeXml(opts.title).slice(0, 90);
  const safeSite = escapeXml(opts.site).slice(0, 60);
  const safeQuote = escapeXml((opts.quote || "").trim()).slice(0, 240);

  // Make it readable on mobile by wrapping into lines
  const lines = wrapLines(safeQuote, 28, 4);
  const baseY = 360;
  const lineHeight = 62;

  const tspans = lines
    .map((ln, i) => `<tspan x="600" y="${baseY + i * lineHeight}">${ln}</tspan>`)
    .join("");

  return `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0f19"/>
        <stop offset="100%" stop-color="#1f2a44"/>
      </linearGradient>

      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    <!-- background -->
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="980" cy="120" r="220" fill="#7c3aed" opacity="0.18"/>
    <circle cx="240" cy="520" r="260" fill="#22c55e" opacity="0.14"/>

    <!-- card -->
    <rect x="70" y="70" width="1060" height="490" rx="34" fill="#0f172a" opacity="0.84" filter="url(#shadow)"/>

    <!-- site label -->
    <text x="120" y="150" font-family="Inter" font-size="28" fill="#a5b4fc" opacity="0.95">
      ${safeSite}
    </text>

    <!-- story title -->
    <text x="120" y="210" font-family="Inter" font-size="40" font-weight="700" fill="#ffffff" opacity="0.95">
      ${safeTitle}
    </text>

    <!-- quote panel -->
    <rect x="120" y="255" width="960" height="280" rx="28" fill="#000000" opacity="0.30"/>

    <!-- centered quote -->
    <text text-anchor="middle" font-family="Inter" font-size="56" font-weight="700" fill="#ffffff">
      ${tspans || `<tspan x="600" y="390">“”</tspan>`}
    </text>
  </svg>`;
}

/* -----------------------------
   6) Worker handler
----------------------------- */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Expect: /og/stories/<slug>.png
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+)\.png$/i);
    if (!match) return new Response("Use /og/stories/<slug>.png", { status: 200 });

    const slug = match[1];

    // Edge cache for generated PNG (prevents resource limit issues)
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Defaults
    let title = "Hidden Spot Cafe";
    let quote = "Short Taglish fantasy stories for your commute.";

    // Fetch story data
    const story = await getStoryBySlug(slug);
    if (story) {
      title = story.title || title;
      quote = (story.ogQuote || story.excerpt || story.description || quote).trim();
      if (!quote) quote = "Hidden Spot Cafe Stories";
    } else {
      title = "Story not found";
      quote = `Slug: ${slug}`;
    }

    // Init WASM + load font bytes
    await ensureWasm();
    const fonts = await ensureFontBytes(url.origin);

    // Build SVG
    const svg = buildSvg({ title, quote, site: SITE_LABEL });

    // Render SVG -> PNG with fontBuffers (CRUCIAL)
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        // ✅ correct field name for in-memory fonts in resvg-wasm
        fontBuffers: [fonts.regular, fonts.bold],
        defaultFontFamily: "Inter",
      },
    });

    const pngBuffer = resvg.render().asPng();

    // While testing, keep cache short.
    // Once you're happy, increase to 86400+ for performance.
    const response = new Response(pngBuffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400"      },
    });

    await cache.put(cacheKey, response.clone());
    return response;
  },
};
