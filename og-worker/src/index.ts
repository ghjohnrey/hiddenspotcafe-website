/**
 * OG Image Generator (Mobile Safe Layout)
 * - Safer padding for Facebook mobile crop
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

async function getStoryBySlug(slug: string): Promise<Story | null> {
  const res = await fetch(STORIES_JSON_URL, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });

  if (!res.ok) return null;

  const data: any = await res.json();
  const stories: Story[] = Array.isArray(data) ? data : data?.stories || [];
  return stories.find((s) => s.slug === slug) || null;
}

function buildSvg(opts: { title: string; quote: string; site: string }): string {
  const safeTitle = escapeXml(opts.title).slice(0, 90);
  const safeSite = escapeXml(opts.site).slice(0, 60);
  const safeQuote = escapeXml(opts.quote).slice(0, 260);

  // SAFE ZONE PADDING
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

    <!-- background -->
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="980" cy="120" r="220" fill="#7c3aed" opacity="0.15"/>
    <circle cx="240" cy="520" r="260" fill="#22c55e" opacity="0.12"/>

    <!-- SAFE AREA CARD -->
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

    <!-- Site -->
    <text 
      x="${outerPadding + 60}" 
      y="${outerPadding + 70}" 
      font-family="Inter" 
      font-size="26" 
      fill="#a5b4fc">
      ${safeSite}
    </text>

    <!-- Title -->
    <text 
      x="${outerPadding + 60}" 
      y="${outerPadding + 130}" 
      font-family="Inter" 
      font-size="38" 
      font-weight="800" 
      fill="#ffffff">
      ${safeTitle}
    </text>

    <!-- Quote Panel -->
    <rect 
      x="${outerPadding + 60}" 
      y="${outerPadding + 180}" 
      width="${cardWidth - 120}" 
      height="260" 
      rx="28" 
      fill="#000000" 
      opacity="0.35"
    />

    <!-- Quote -->
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

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+)\.png$/i);
    if (!match) return new Response("Use /og/stories/<slug>.png");

    const slug = match[1];

    const story = await getStoryBySlug(slug);

    const title = story?.title || "Hidden Spot Cafe";
    const quote =
      story?.ogQuote ||
      story?.excerpt ||
      story?.description ||
      "Short Taglish fantasy stories for your commute.";

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

    return new Response(pngBuffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      },
    });
  },
};
