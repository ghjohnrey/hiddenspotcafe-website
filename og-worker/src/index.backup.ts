import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";

function escapeXml(str = ""): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvg(opts: { title: string; desc: string; site: string }): string {
  const safeTitle = escapeXml(opts.title).slice(0, 90);
  const safeDesc = escapeXml(opts.desc).slice(0, 160);
  const safeSite = escapeXml(opts.site).slice(0, 60);

  return `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0f19"/>
        <stop offset="100%" stop-color="#1f2a44"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="980" cy="120" r="220" fill="#7c3aed" opacity="0.16"/>
    <circle cx="240" cy="520" r="260" fill="#22c55e" opacity="0.12"/>

    <rect x="80" y="90" width="1040" height="450" rx="28" fill="#0f172a" opacity="0.78" filter="url(#shadow)"/>

    <text x="120" y="190" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="28" fill="#a5b4fc">
      ${safeSite}
    </text>

    <foreignObject x="120" y="230" width="960" height="210">
      <div xmlns="http://www.w3.org/1999/xhtml"
        style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial;
               font-size: 72px; font-weight: 800; line-height: 1.05; color: #ffffff;">
        ${safeTitle}
      </div>
    </foreignObject>

    <foreignObject x="120" y="460" width="960" height="120">
      <div xmlns="http://www.w3.org/1999/xhtml"
        style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial;
               font-size: 34px; font-weight: 500; line-height: 1.2; color: #cbd5e1;">
        ${safeDesc}
      </div>
    </foreignObject>
  </svg>`;
}

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
  if (!wasmInit) {
    wasmInit = initWasm(wasmModule as unknown as WebAssembly.Module);
  }
  await wasmInit;
}

async function getStoryBySlug(slug: string): Promise<Story | null> {
  const res = await fetch(STORIES_JSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch stories.json (${res.status})`);

  const data: any = await res.json();
  const stories: Story[] = Array.isArray(data) ? data : (data.stories || []);
  return stories.find((s) => s.slug === slug) || null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Expect: /og/stories/<slug>.png
    const match = url.pathname.match(/^\/og\/stories\/([a-z0-9-]+)\.png$/i);
    if (!match) {
      return new Response("Use /og/stories/<slug>.png", { status: 200 });
    }

    const slug = match[1];

    let title = "Hidden Spot Cafe";
    let desc = "Short Taglish fantasy stories for your commute.";

    try {
      const story = await getStoryBySlug(slug);
      if (story) {
        title = story.title || title;
        desc = story.ogQuote || story.excerpt || story.description || desc;
      } else {
        title = "Story not found";
        desc = `Slug: ${slug}`;
      }
    } catch {
      title = "OG generator error";
      desc = "Could not load story data.";
    }

    const svg = buildSvg({ title, desc, site: SITE_LABEL });

    // ✅ REQUIRED: initialize wasm before using Resvg
    await ensureWasm();

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
    const pngBuffer = resvg.render().asPng();

    return new Response(pngBuffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  },
};