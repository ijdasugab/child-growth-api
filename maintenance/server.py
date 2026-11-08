#!/usr/bin/env python3
"""Halaman maintenance untuk natababy.online.

Dipakai selama perbaikan P1/P2. Menempati port 3000 supaya tunnel Cloudflare
tetap punya tujuan, tapi semua request dibalas halaman maintenance dengan
status 503.

Matikan service ini sebelum menyalakan child-growth-api lagi, karena keduanya
memakai port yang sama.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PAGE = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nata Baby sedang dirawat</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #FFF8F6; color: #17223B;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px;
  }
  .card {
    background: #FFFFFF; border: 1px solid #FFD4E2; border-radius: 20px;
    max-width: 520px; width: 100%; padding: 40px 32px; text-align: center;
    box-shadow: 0 10px 30px rgba(30, 41, 59, 0.08);
  }
  .badge {
    display: inline-block; background: #FFE6EF; color: #E04376;
    border-radius: 999px; padding: 6px 14px; font-size: 13px;
    font-weight: 600; margin-bottom: 20px;
  }
  h1 { font-size: 26px; margin: 0 0 12px; line-height: 1.3; }
  p { color: #6B7280; font-size: 15px; line-height: 1.6; margin: 0 0 10px; }
  .note {
    margin-top: 24px; padding-top: 20px; border-top: 1px solid #FFE6EF;
    font-size: 13px; color: #9CA3AF;
  }
</style>
</head>
<body>
  <div class="card">
    <span class="badge">Maintenance</span>
    <h1>Nata Baby sedang dirawat</h1>
    <p>
      Kami sedang memperbaiki keamanan dan integritas data. Data lama sudah
      dibersihkan, jadi saat situs kembali kamu akan mulai dari akun baru.
    </p>
    <p>Perkiraan selesai: hari ini.</p>
    <div class="note">Terima kasih sudah menunggu.</div>
  </div>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = PAGE.encode("utf-8")
        self.send_response(503)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Retry-After", "3600")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # Semua metode lain dibalas sama, termasuk POST dari webhook atau bot.
    do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = do_GET

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 3000), Handler).serve_forever()
