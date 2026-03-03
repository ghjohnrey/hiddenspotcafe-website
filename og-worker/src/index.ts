/**
 * OG Image Generator (Mobile Safe Layout)
 * Fixes:
 * - NEVER throws to the client (Facebook must never receive HTML error pages)
 * - Safer JSON fetch/parsing for stories.json (prevents res.json() crash)
 * - Always returns image/png for the OG route
 * - Returns a readable fallback PNG with text if anything fails
 */

import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmBinary from "@resvg/resvg-wasm/index_bg.wasm";

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

let wasmInit: Promise<void> | null = null;

async function ensureWasm() {
  if (!wasmInit) wasmInit = initWasm(wasmBinary);
  await wasmInit;
}

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
  return lines;
}

/**
 * IMPORTANT: This must NEVER throw.
 * If stories.json returns HTML / errors / invalid JSON, we just return null.
 */
async function getStoryBySlug(slug: string): Promise<Story | null> {
  try {
    const res = await fetch(STORIES_JSON_URL, {
      cf: { cacheTtl: 300, cacheEverything: true },
      headers: {
        // Helps avoid certain bot/protection responses returning HTML
        "accept": "application/json,text/plain,*/*",
        "user-agent": "Mozilla/5.0 (compatible; Hiddenspot OG Worker)",
      },
    });

    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "";
    // If Cloudflare returns an HTML error page, this prevents res.json() from throwing
    if (!ct.includes("application/json")) return null;

    const data: any = await res.json();
    const stories: Story[] = Array.isArray(data) ? data : data?.stories || [];
    return stories.find((s) => s.slug === slug) || null;
  } catch {
    return null;
  }
}

function buildSvg(opts: { title: string; quote: string; site: string }): string {
  const safeTitle = escapeXml(opts.title).slice(0, 90);
  const safeSite = escapeXml(opts.site).slice(0, 60);
  const safeQuote = escapeXml(opts.quote).slice(0, 260);

  const outerPadding = 120;
  const cardWidth = 1200 - outerPadding * 2;
  const cardHeight = 630 - outerPadding * 2;

  const lines = wrapLines(safeQuote, 26, 4);
  const baseY = 380;
  const lineHeight = 58;

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
        <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="980" cy="120" r="220" fill="#7c3aed" opacity="0.15"/>
    <circle cx="240" cy="520" r="260" fill="#22c55e" opacity="0.12"/>

    <rect
      x="${outerPadding}"
      y="${outerPadding}"
      width="${cardWidth}"
      height="${cardHeight}"
      rx="36"
      fill="#0f172a"
      opacity="0.88"
      filter="url(#shadow)"
    />

    <text
      x="${outerPadding + 60}"
      y="${outerPadding + 70}"
      font-family="Inter"
      font-size="26"
      fill="#a5b4fc">
      ${safeSite}
    </text>

    <text
      x="${outerPadding + 60}"
      y="${outerPadding + 130}"
      font-family="Inter"
      font-size="38"
      font-weight="800"
      fill="#ffffff">
      ${safeTitle}
    </text>

    <rect
      x="${outerPadding + 60}"
      y="${outerPadding + 180}"
      width="${cardWidth - 120}"
      height="260"
      rx="28"
      fill="#000000"
      opacity="0.35"
    />

    <text
      text-anchor="middle"
      font-family="Inter"
      font-size="54"
      font-weight="800"
      fill="#ffffff">
      ${tspans}
    </text>
  </svg>`;
}

function pngHeaders(cacheControl: string) {
  return {
    "Content-Type": "image/png",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // NOTE: pathname does not include ?v=2, so your cache-busting query is fine
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+)\.png$/i);
    if (!match) return new Response("Not Found", { status: 404 });

    // If Facebook does a HEAD request, return fast with proper image headers
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers: pngHeaders("public, max-age=300, s-maxage=300") });
    }

    const slug = match[1];

    // Defaults (so even if stories.json fails, text still renders)
    let title = "Hidden Spot Cafe";
    let quote = "Short Taglish fantasy stories for your commute.";

    try {
      const story = await getStoryBySlug(slug);
      title = story?.title || title;
      quote = story?.ogQuote || story?.excerpt || story?.description || quote;

      await ensureWasm();

      const svg = buildSvg({ title, quote, site: SITE_LABEL });

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

      // IMPORTANT while debugging: keep cache short so Facebook updates quickly
      return new Response(pngBuffer, {
        status: 200,
        headers: pngHeaders("public, max-age=300, s-maxage=300"),
      });
    } catch {
      // If anything goes wrong, return a fallback PNG WITH TEXT (not blank),
      // still with image/png content-type.
      try {
        await ensureWasm();

        const fallbackSvg = buildSvg({
          title,
          quote,
          site: SITE_LABEL,
        });

        const fontRegular = new Uint8Array(fontRegularBuffer);
        const fontBold = new Uint8Array(fontBoldBuffer);

        const resvg = new Resvg(fallbackSvg, {
          fitTo: { mode: "width", value: 1200 },
          font: {
            fontBuffers: [fontRegular, fontBold],
            defaultFontFamily: "Inter",
          },
        });

        const fallbackPng = resvg.render().asPng();

        return new Response(fallbackPng, {
          status: 200,
          headers: pngHeaders("no-store"),
        });
      } catch {
        // Last-resort: tiny PNG (still image/png)
        const oneByOnePng = Uint8Array.from([
          137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,
          137,0,0,0,10,73,68,65,84,120,156,99,0,1,0,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130
        ]);

        return new Response(oneByOnePng, {
          status: 200,
          headers: pngHeaders("no-store"),
        });
      }
    }
  },
};
