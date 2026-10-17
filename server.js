const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname);
  } catch (_) {
    res.writeHead(400);
    return res.end("Bad Request");
  }

  // This MVP is a single-page static app.
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, "." + pathname);

  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(err.code === "ENOENT" ? "Not Found" : "Server Error");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lucky Party Wheel server listening on port ${PORT}`);
});
