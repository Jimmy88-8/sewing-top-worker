/**
 * Zero-dependency local dev server (no wrangler needed).
 *
 * Mimics the Cloudflare Workers Static Assets request flow:
 *   1. try to serve the path from ./public (like the edge asset layer)
 *   2. otherwise invoke the Worker's fetch handler from ./src/index.js
 *
 * Usage: node scripts/dev-server.mjs   ->  http://localhost:8787
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";

const PORT = process.env.PORT ?? 8787;
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function serveAsset(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replaceAll("..", "");
  const fp = join(PUBLIC, clean === sep || clean === "/" ? "index.html" : clean);
  if (!fp.startsWith(PUBLIC)) return null;
  try {
    const data = await readFile(fp);
    return new Response(data, {
      headers: { "content-type": MIME[extname(fp)] ?? "application/octet-stream" },
    });
  } catch {
    return null;
  }
}

// Minimal stand-in for the ASSETS binding the Worker sees in production.
const env = {
  ASSETS: {
    fetch: async (request) => {
      const r = await serveAsset(new URL(request.url).pathname);
      return r ?? new Response("not found", { status: 404 });
    },
  },
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let response = url.pathname.startsWith("/api/") ? null : await serveAsset(url.pathname);
    if (!response) {
      response = await worker.fetch(new Request(url, { method: req.method }), env);
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(e?.stack ?? e));
  }
}).listen(PORT, () => {
  console.log(`SewingOS dev server ready: http://localhost:${PORT}`);
});
