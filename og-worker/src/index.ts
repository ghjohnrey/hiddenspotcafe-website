/**
 * Hidden Spot Cafe - OG Image Worker
 *
 * Generates 1200x630 PNG OG images at:
 *   /og/stories/<slug>.png
 *   /og/stories/<slug>-v123.png
 *
 * Adds debug header:
 *   X-OG-Source: html | html-dot | fallback | head | non-og
 *
 * IMPORTANT BEHAVIOR:
 * - For OG routes (/og/stories/*.png), we NEVER return a 1x1 PNG.
 *   If something fails, we still return a FULL 1200x630 fallback image.
 * - For non-OG routes, we can return a tiny PNG (keeps bots happy, saves CPU).
 */

import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmBinary from "@resvg/resvg-wasm/index_bg.wasm";

import fontRegularBuffer from "./fonts/Inter_18pt-Regular.ttf";
import fontBoldBuffer from "./fonts/Inter_18pt-Bold.ttf";

const SITE_LABEL = "Hidden Spot Cafe";

type OgData = {
  title?: string;
  quote?: string;
};

let wasmInit: Promise<void> | null = null;

/**
 * Ensure WASM initializes only once
 * - resvg-wasm needs wasm init; doing it once saves CPU and avoids race issues.
 */
async function ensureWasm() {
  if (!wasmInit) wasmInit = initWasm(wasmBinary);
  await wasmInit;
}

/**
 * Standard PNG headers + custom debug header
 * - Cache-Control is intentionally SHORT for OG images while you're still iterating.
 *   (If you use immutable and FB already cached a bad image, you will suffer.)
 */
function pngHeaders(cacheControl: string, source: string) {
  return {
    "Content-Type": "image/png",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-OG-Source": source, // 👈 DEBUG HEADER (view via curl -i)
  };
}

/**
 * Tiny fallback for NON-OG routes only
 * - This should NEVER be returned for /og/stories/*.png
 * - Used only when route doesn't match to keep random requests safe.
 */
function tinyTransparentPng(): Uint8Array {
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0,
    0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45,
    180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
}

/**
 * Escape text for safe SVG rendering
 * - Prevents broken XML if a quote contains & < > " '
 */
function escapeXml(str = ""): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Basic line wrapping (simple + fast)
 * - We wrap by character count to avoid heavy layout logic.
 */
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
  return lines;
}

/**
 * Build 1200x630 SVG layout
 *
 * Layout goal (as you requested):
 * Line 1: Story time at
 * Line 2: Hidden Spot Cafe
 * Line 3+: Quote (centered inside a panel)
 */
function buildSvg(quote: string): string {
  const safeQuote = escapeXml(quote || "").slice(0, 260);

  const outerPadding = 120;
  const cardWidth = 1200 - outerPadding * 2;
  const cardHeight = 630 - outerPadding * 2;

  const lines = wrapLines(safeQuote, 26, 4);
  const lineHeight = 58;

  const quotePanelY = outerPadding + 170;
  const quotePanelH = 270;
  const quoteCenterY = quotePanelY + quotePanelH / 2;

  // vertically center the wrapped lines within the quote panel
  const totalTextHeight = (lines.length - 1) * lineHeight;
  const firstLineY = Math.round(quoteCenterY - totalTextHeight / 2);

  const tspans = lines
    .map((ln, i) => `<tspan x="600" y="${firstLineY + i * lineHeight}">${ln}</tspan>`)
    .join("");

  return `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0f19"/>
        <stop offset="100%" stop-color="#1f2a44"/>
      </linearGradient>

      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="980" cy="120" r="220" fill="#7c3aed" opacity="0.15"/>
    <circle cx="240" cy="520" r="260" fill="#22c55e" opacity="0.12"/>

    <!-- Safe card area -->
    <rect
      x="${outerPadding}"
      y="${outerPadding}"
      width="${cardWidth}"
      height="${cardHeight}"
      rx="36"
      fill="#0f172a"
      opacity="0.90"
      filter="url(#shadow)"
    />

    <!-- Header line 1 -->
    <text x="${outerPadding + 60}" y="${outerPadding + 70}"
      font-family="Inter" font-size="26" fill="#a5b4fc">
      Story time at
    </text>

    <!-- Header line 2 -->
    <text x="${outerPadding + 60}" y="${outerPadding + 125}"
      font-family="Inter" font-size="40" font-weight="800" fill="#ffffff">
      ${escapeXml(SITE_LABEL)}
    </text>

    <!-- Quote panel -->
    <rect
      x="${outerPadding + 60}"
      y="${quotePanelY}"
      width="${cardWidth - 120}"
      height="${quotePanelH}"
      rx="28"
      fill="#000000"
      opacity="0.35"
    />

    <!-- Quote text (line 3+) -->
    <text text-anchor="middle"
      font-family="Inter"
      font-size="54"
      font-weight="800"
      fill="#ffffff">
      ${tspans || `<tspan x="600" y="${quoteCenterY}">…</tspan>`}
    </text>
  </svg>`;
}

/**
 * Extract og-data JSON safely (attribute order independent)
 *
 * Accepts:
 * <script type="application/json" id="og-data">...</script>
 * or reversed attribute order.
 */
function extractOgData(html: string): OgData | null {
  const re =
    /<script\b(?=[^>]*\bid=["']og-data["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i;

  const m = html.match(re);
  if (!m?.[1]) return null;

  try {
    const parsed = JSON.parse(m[1].trim());
    // Only accept objects
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as OgData;
  } catch {
    return null;
  }
}

/**
 * Fetch story HTML (tries clean + .html)
 *
 * Why this exists:
 * - Some of your stories are /stories/<slug>
 * - Some are /stories/<slug>.html
 *
 * Debug labels:
 * - html     => /stories/<slug>
 * - html-dot => /stories/<slug>.html
 * - fallback => nothing found / fetch failed
 */
async function getOgData(slug: string): Promise<{ data: OgData | null; source: string }> {
  const urls = [
    { url: `https://hiddenspotcafe.com/stories/${slug}`, label: "html" },
    { url: `https://hiddenspotcafe.com/stories/${slug}.html`, label: "html-dot" },
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u.url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; HSC OG Worker)",
          accept: "text/html,*/*",
        },
        // CF cache helps performance; keep short
        cf: { cacheTtl: 300, cacheEverything: true },
      });

      if (!res.ok) continue;

      // Optional: refuse non-html responses
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("text/html")) {
        // still try because some servers send weird CT, but usually skip
        // continue;
      }

      const html = await res.text();
      const data = extractOgData(html);

      // We only need quote for the image, title is optional.
      if (data?.quote && String(data.quote).trim().length > 0) {
        return { data, source: u.label };
      }
    } catch {
      continue;
    }
  }

  return { data: null, source: "fallback" };
}

/**
 * Render a FULL-SIZE PNG (1200x630) from a quote.
 * This is used for both success and fallback, so we never output 1x1 on OG routes.
 */
async function renderPngFull(quote: string): Promise<Uint8Array> {
  await ensureWasm();

  const svg = buildSvg(quote);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      fontBuffers: [new Uint8Array(fontRegularBuffer), new Uint8Array(fontBoldBuffer)],
      defaultFontFamily: "Inter",
    },
  });

  return resvg.render().asPng();
}

/**
 * MAIN WORKER HANDLER
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Match:
    // /og/stories/slug.png
    // /og/stories/slug-v123.png
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+?)(?:-v\d+)?\.png$/i);

    // Non-OG routes: return tiny PNG (cheap + safe)
    if (!match) {
      return new Response(tinyTransparentPng(), {
        status: 200,
        headers: pngHeaders("public, max-age=86400", "non-og"),
      });
    }

    // HEAD requests: bots sometimes do HEAD before GET.
    // NOTE: HEAD cannot tell you html/html-dot because we don't fetch.
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        // short cache while debugging (avoid stale)
        headers: pngHeaders("public, max-age=300, s-maxage=300", "head"),
      });
    }

    const slug = match[1];

    try {
      const { data, source } = await getOgData(slug);

      const quote =
        (data?.quote && String(data.quote).trim()) ||
        "Short Taglish fantasy stories for your commute.";

      const pngBuffer = await renderPngFull(quote);

      // IMPORTANT: short cache while you're iterating/publishing
      return new Response(pngBuffer, {
        status: 200,
        headers: pngHeaders("public, max-age=300, s-maxage=300", source),
      });
    } catch {
      // Guaranteed FULL-SIZE fallback (never 1x1 for OG route)
      const pngBuffer = await renderPngFull("Short Taglish stories for your commute.");

      return new Response(pngBuffer, {
        status: 200,
        headers: pngHeaders("public, max-age=300, s-maxage=300", "fallback"),
      });
    }
  },
};
