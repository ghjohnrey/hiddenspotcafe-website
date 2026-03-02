/**
 * OG Image Generator (Cloudflare Worker)
 * - Generates: /og/stories/<slug>.png
 * - Loads story data from: https://hiddenspotcafe.com/stories/stories.json
 * - Bundles fonts + wasm (NO HTTP fetch for fonts) to avoid "no text" issues in production
 */

import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmBinary from "@resvg/resvg-wasm/index_bg.wasm";

// ✅ Fonts are bundled from src/fonts (no network fetch)
import fontRegularBuffer from "./fonts/Inter_18pt-Regular.ttf";
import fontBoldBuffer from "./fonts/Inter_18pt-Bold.ttf";

const STORIES_JSON_URL = "https://hiddenspotcafe.com/stories/stories.json";
const SITE_LABEL = "Hidden Spot Cafe";

type Story = {
  slug?: string;
  title?: string;
  excerpt?: string;
  ogQuote?: string;
  description?: string;
};

/* -----------------------------
   1) resvg WASM init (only once)
----------------------------- */
let wasmInit: Promise<void> | null = null;

async function ensureWasm() {
  if (!wasmInit) {
    // wasmBinary is an ArrayBuffer (from bundler rule: CompiledWasm)
    wasmInit = initWasm(wasmBinary);
  }
  await wasmInit;
}

/* -----------------------------
   2) Helpers
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
   4) SVG builder
----------------------------- */
function buildSvg(opts: { title: string; quote: string; site: string }): string {
  const safeTitle = escapeXml(opts.title).slice(0, 90);
  const safeSite = escapeXml(opts.site).slice(0, 60);
  const safeQuote = escapeXml((opts.quote || "").trim()).slice(0, 240);

  const lines = wrapLines(safeQuote, 28, 4);
  const baseY = 375;
  const lineHeight = 62;

  const tspans = lines
    .map(
      (ln, i) => `<tspan x="600" y="${baseY + i * lineHeight}">${ln}</tspan>`
    )
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

    <!-- main card -->
    <rect x="70" y="70" width="1060" height="490" rx="34" fill="#0f172a" opacity="0.84" filter="url(#shadow)"/>

    <!-- site -->
    <text x="120" y="150" font-family="Inter" font-size="28" fill="#a5b4fc" opacity="0.95">
      ${safeSite}
    </text>

    <!-- title -->
    <text x="120" y="210" font-family="Inter" font-size="40" font-weight="800" fill="#ffffff" opacity="0.95">
      ${safeTitle}
    </text>

    <!-- quote panel -->
    <rect x="120" y="255" width="960" height="280" rx="28" fill="#000000" opacity="0.30"/>

    <!-- quote -->
    <text text-anchor="middle" font-family="Inter" font-size="56" font-weight="800" fill="#ffffff">
      ${tspans || `<tspan x="600" y="400">“”</tspan>`}
    </text>
  </svg>`;
}

/* -----------------------------
   5) Worker handler
----------------------------- */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Only handle: /og/stories/<slug>.png
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+)\.png$/i);
    if (!match) {
      return new Response("Use /og/stories/<slug>.png", { status: 200 });
    }

    const slug = match[1];

    // Edge cache
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Defaults
    let title = "Hidden Spot Cafe";
    let quote = "Short Taglish fantasy stories for your commute.";

    // Pull from stories.json
    const story = await getStoryBySlug(slug);
    if (story) {
      title = story.title || title;
      quote = (story.ogQuote || story.excerpt || story.description || quote).trim();
      if (!quote) quote = "Hidden Spot Cafe Stories";
    } else {
      title = "Story not found";
      quote = `Slug: ${slug}`;
    }

    await ensureWasm();

    const svg = buildSvg({ title, quote, site: SITE_LABEL });

    // ✅ fonts must be Uint8Array (wrap the ArrayBuffer)
    const fontRegular = new Uint8Array(fontRegularBuffer);
    const fontBold = new Uint8Array(fontBoldBuffer);

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers: [fontRegular, fontBold],
        defaultFontFamily: "Inter",
      },
    });

    const pngBuffer = resvg.render().asPng();

    const response = new Response(pngBuffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      },
    });

    await cache.put(cacheKey, response.clone());
    return response;
  },
};
