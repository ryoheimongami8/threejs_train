"""Static server + POST /save?path=out/... (used by the exporter to write PNG layers to disk)."""
import http.server, os, sys, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8048


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != '/save':
            self.send_error(404); return
        rel = urllib.parse.parse_qs(u.query).get('path', [''])[0]
        dest = os.path.normpath(os.path.join(ROOT, rel))
        # only inside <root>/out or <root>/projects
        ok = any(dest.startswith(os.path.join(ROOT, d) + os.sep) for d in ('out', 'projects'))
        if not ok:
            self.send_error(403); return
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        n = int(self.headers.get('Content-Length', 0))
        with open(dest, 'wb') as f:
            f.write(self.rfile.read(n))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')


if __name__ == '__main__':
    print(f'http://localhost:{PORT}/')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
