#!/bin/bash
# Подвійний клік у Finder запускає локальний сервер і відкриває браузер.
# (Браузер не дає завантажувати модулі з file://, тому потрібен сервер.)
cd "$(dirname "$0")" || exit 1
PORT=8001
URL="http://localhost:$PORT"

if command -v python3 >/dev/null 2>&1 && python3 -c "import http.server" >/dev/null 2>&1; then
  echo "Відкриваю $URL  (щоб зупинити — Ctrl+C або закрий це вікно)"
  (sleep 1; open "$URL") &
  # сервер без кешування, щоб браузер завжди брав свіжі файли після змін
  python3 -c "
import http.server
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', $PORT), H).serve_forever()
"
elif command -v npx >/dev/null 2>&1; then
  echo "Відкриваю $URL  (щоб зупинити — Ctrl+C або закрий це вікно)"
  (sleep 3; open "$URL") &
  npx --yes http-server -p "$PORT" -c-1 .
else
  echo "Потрібен python3 або Node.js."
  echo "Найпростіше: виконай у Терміналі  xcode-select --install  і запусти цей файл знову."
  read -r -p "Натисни Enter, щоб закрити…"
fi
