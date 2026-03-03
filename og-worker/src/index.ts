/**
 * Hidden Spot Cafe - OG Image Worker
 *
 * Generates 1200x630 PNG OG images at:
 *   /og/stories/<slug>.png
 *   /og/stories/<slug>-v123.png
 *
 * Adds debug header:
 *   X-OG-Source: html | html-dot | fallback
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
 */
async function ensureWasm() {
  if (!wasmInit) wasmInit = initWasm(wasmBinary);
  await wasmInit;
}

/**
 * Standard PNG headers + custom debug header
 */
function pngHeaders(cacheControl: string, source: string) {
  return {
    "Content-Type": "image/png",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-OG-Source": source, // 👈 DEBUG HEADER
  };
}

/**
 * Tiny fallback for NON-OG routes only
 */
function tinyTransparentPng(): Uint8Array {
  return Uint8Array.from([
    137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,
    0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,99,0,1,0,0,5,0,1,13,10,
    45,180,0,0,0,0,73,69,78,68,174,66,96,130
  ]);
}

/**
 * Escape text for safe SVG rendering
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
 * Basic line wrapping
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
 * Layout:
 * Line 1: Story time at
 * Line 2: Hidden Spot Cafe
 * Line 3+: Quote
 */
function buildSvg(quote: string): string {
  const safeQuote = escapeXml(quote).slice(0, 260);

  const outerPadding = 120;
  const cardWidth = 1200 - outerPadding * 2;
  const cardHeight = 630 - outerPadding * 2;

  const lines = wrapLines(safeQuote, 26, 4);
  const lineHeight = 58;

  const quotePanelY = outerPadding + 170;
  const quotePanelH = 270;
  const quoteCenterY = quotePanelY + quotePanelH / 2;

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
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>

    <rect
      x="${outerPadding}"
      y="${outerPadding}"
      width="${cardWidth}"
      height="${cardHeight}"
      rx="36"
      fill="#0f172a"
      opacity="0.9"
    />

    <!-- Header -->
    <text x="${outerPadding + 60}" y="${outerPadding + 70}"
      font-family="Inter" font-size="26" fill="#a5b4fc">
      Story time at
    </text>

    <text x="${outerPadding + 60}" y="${outerPadding + 125}"
      font-family="Inter" font-size="40" font-weight="800" fill="#ffffff">
      ${SITE_LABEL}
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

    <text text-anchor="middle"
      font-family="Inter"
      font-size="54"
      font-weight="800"
      fill="#ffffff">
      ${tspans}
    </text>
  </svg>`;
}

/**
 * Extract og-data JSON safely (attribute order independent)
 */
function extractOgData(html: string): OgData | null {
  const re =
    /<script\b(?=[^>]*\bid=["']og-data["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i;

  const m = html.match(re);
  if (!m?.[1]) return null;

  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

/**
 * Fetch story HTML (tries clean + .html)
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
        cf: { cacheTtl: 300, cacheEverything: true },
      });

      if (!res.ok) continue;

      const html = await res.text();
      const data = extractOgData(html);

      // Accept if either title OR quote exists (prevents false fallback)
      if (data && (data.title || data.quote)) {
        return { data, source: u.label };
      }
    } catch {
      continue;
    }
  }

  return { data: null, source: "fallback" };
}

/**
 * MAIN WORKER HANDLER
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+?)(?:-v\d+)?\.png$/i);

    if (!match) {
      return new Response(tinyTransparentPng(), {
        status: 200,
        headers: pngHeaders("public, max-age=86400", "non-og"),
      });
    }

    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: pngHeaders("public, max-age=31536000, immutable", "head"),
      });
    }

    const slug = match[1];

    try {
      const { data, source } = await getOgData(slug);

      const quote =
        data?.quote ||
        "Short Taglish fantasy stories for your commute.";

      await ensureWasm();

      const svg = buildSvg(quote);

      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: 1200 },
        font: {
          fontBuffers: [
            new Uint8Array(fontRegularBuffer),
            new Uint8Array(fontBoldBuffer),
          ],
          defaultFontFamily: "Inter",
        },
      });

      const pngBuffer = resvg.render().asPng();

      return new Response(pngBuffer, {
        status: 200,
        headers: pngHeaders("public, max-age=31536000, immutable", source),
      });
    } catch {
      // Guaranteed full-size fallback
      await ensureWasm();
      const svg = buildSvg("Short Taglish fantasy stories for your commute.");
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: 1200 },
        font: {
          fontBuffers: [
            new Uint8Array(fontRegularBuffer),
            new Uint8Array(fontBoldBuffer),
          ],
          defaultFontFamily: "Inter",
        },
      });

      return new Response(resvg.render().asPng(), {
        status: 200,
        headers: pngHeaders("public, max-age=86400", "fallback"),
      });
    }
  },
};
