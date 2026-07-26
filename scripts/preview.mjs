import "dotenv/config";

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const serverEntry = resolve(".output/server/index.mjs");
const publicDirectory = resolve(".output/public");
const contentTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

await access(serverEntry).catch(() => {
  throw new Error("Production build not found. Run `pnpm build` before `pnpm preview`.");
});

const builtServerModule = await import(pathToFileURL(serverEntry).href);
const builtServer = builtServerModule.default ?? builtServerModule;

if (typeof builtServer.fetch !== "function") {
  throw new TypeError("The Nitro server entry does not export a fetch handler.");
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host ?? `${host}:${port}`}`;
    const url = new URL(incoming.url ?? "/", origin);
    if (await serveStatic(url, outgoing)) return;

    const method = incoming.method ?? "GET";
    const hasBody = method !== "GET" && method !== "HEAD";
    const request = new Request(url, {
      method,
      headers: incoming.headers,
      ...(hasBody
        ? {
            body: Readable.toWeb(incoming),
            duplex: "half",
          }
        : {}),
    });
    const pending = [];
    const response = await builtServer.fetch(request, process.env, {
      waitUntil(promise) {
        pending.push(Promise.resolve(promise));
      },
      passThroughOnException() {},
    });

    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));

    if (!response.body) {
      outgoing.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(outgoing);
    void Promise.allSettled(pending);
  } catch (error) {
    console.error(error);
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "text/plain; charset=utf-8");
    outgoing.end("Preview server error");
  }
});

async function serveStatic(url, response) {
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!relativePath) return false;

  const filePath = resolve(publicDirectory, relativePath);
  if (!filePath.startsWith(`${publicDirectory}${sep}`)) return false;

  const fileStats = await stat(filePath).catch(() => null);
  if (!fileStats?.isFile()) return false;

  response.statusCode = 200;
  response.setHeader(
    "content-type",
    contentTypes.get(extname(filePath)) ?? "application/octet-stream",
  );
  response.setHeader("content-length", String(fileStats.size));
  response.setHeader("cache-control", "public, max-age=31536000, immutable");
  createReadStream(filePath).pipe(response);
  return true;
}

server.listen(port, host, () => {
  console.log(`Production preview: http://${host}:${port}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
