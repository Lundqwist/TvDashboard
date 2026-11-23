// Tiny static server for previewing the TV app in a desktop browser: node tools/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 8097);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.includes('$WEBAPIS')) return res.writeHead(200, { 'Content-Type': 'text/javascript' }).end('');
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`TV app preview at http://127.0.0.1:${port}`));
