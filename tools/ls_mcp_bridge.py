"""stdio <-> Lens Studio MCP bridge (Windows workaround).

Why: on this PC a local HTTP filter (antivirus web shield) rewrites loopback
HTTP responses to `transfer-encoding: chunked` without chunk framing and keeps
the connection open. Strict clients (Claude Code's fetch) then fail with
InvalidHTTPResponse, so the Lens Studio MCP server (http://localhost:50040/mcp)
looks "down" even though it is running.

What: Claude Code talks to this script over stdio (newline-delimited JSON-RPC).
Each message is POSTed to Lens Studio over a raw socket and the reply is read
tolerantly (complete JSON / real chunked / SSE), then written back to stdout.

Token: read on every request from the project's .mcp.json entry `lens-studio`
(Lens Studio rewrites that file with a fresh token at each start), so nothing
secret lives in this script or in Claude Code's config. Nothing is logged.

Usage (registered as a local-scope stdio server named `lens-studio`):
    python ls_mcp_bridge.py <path-to-project-.mcp.json>
"""
import json
import socket
import sys
import threading
import time
from urllib.parse import urlparse

MCP_JSON = sys.argv[1] if len(sys.argv) > 1 else ".mcp.json"
OUT_LOCK = threading.Lock()
SESSION = {"id": None}


def upstream():
    with open(MCP_JSON, encoding="utf-8") as f:
        entry = json.load(f)["mcpServers"]["lens-studio"]
    u = urlparse(entry["url"])
    return u.hostname or "localhost", u.port or 80, u.path or "/mcp", entry.get("headers", {})


def _dechunk(raw):
    out, i = b"", 0
    while True:
        j = raw.find(b"\r\n", i)
        if j < 0:
            return None
        try:
            size = int(raw[i:j].split(b";")[0], 16)
        except ValueError:
            return None
        i = j + 2
        if size == 0:
            return out
        if len(raw) < i + size + 2:
            return None
        out += raw[i:i + size]
        i += size + 2


def _parse_json(b):
    s = b.strip()
    if not s:
        return None
    try:
        return json.loads(s.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def _parse_sse(b, want_id):
    for block in b.replace(b"\r\n", b"\n").split(b"\n\n"):
        data = b"".join(l[5:].lstrip() for l in block.split(b"\n") if l.startswith(b"data:"))
        msg = _parse_json(data)
        if isinstance(msg, dict) and (want_id is None or msg.get("id") == want_id):
            return msg
    return None


def post(msg):
    host, port, path, headers = upstream()
    payload = json.dumps(msg).encode("utf-8")
    lines = [f"POST {path} HTTP/1.1", f"Host: {host}:{port}",
             "Content-Type: application/json",
             "Accept: application/json, text/event-stream",
             f"Content-Length: {len(payload)}", "Connection: close"]
    for k, v in headers.items():
        lines.append(f"{k}: {v}")
    if SESSION["id"]:
        lines.append(f"Mcp-Session-Id: {SESSION['id']}")
    s = socket.create_connection(("127.0.0.1" if host == "localhost" else host, port), timeout=900)
    try:
        s.sendall(("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + payload)
        buf = b""
        while b"\r\n\r\n" not in buf:
            c = s.recv(65536)
            if not c:
                break
            buf += c
        head, _, body = buf.partition(b"\r\n\r\n")
        hl = head.decode("latin-1").split("\r\n")
        status = int(hl[0].split()[1]) if hl and len(hl[0].split()) > 1 else 0
        rh = {}
        for line in hl[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                rh[k.strip().lower()] = v.strip()
        if rh.get("mcp-session-id"):
            SESSION["id"] = rh["mcp-session-id"]
        if status == 204 or status == 202 or "id" not in msg:
            return status, None
        ctype = rh.get("content-type", "")
        want = msg.get("id")
        s.settimeout(0.5)
        last = time.time()
        while True:
            if "event-stream" in ctype:
                got = _parse_sse(body, want) or _parse_sse(_dechunk(body) or b"", want)
            else:
                got = _parse_json(body)
                if got is None:
                    d = _dechunk(body)
                    got = _parse_json(d) if d is not None else None
            if got is not None:
                return status, got
            try:
                c = s.recv(65536)
                if not c:
                    break
                body += c
                last = time.time()
            except socket.timeout:
                if time.time() - last > 900:
                    break
        return status, None
    finally:
        s.close()


def write(obj):
    data = json.dumps(obj, ensure_ascii=False) + "\n"
    with OUT_LOCK:
        sys.stdout.write(data)
        sys.stdout.flush()


def handle(msg):
    try:
        status, reply = post(msg)
        if "id" in msg:
            if reply is None:
                reply = {"jsonrpc": "2.0", "id": msg["id"],
                         "error": {"code": -32603, "message": f"Lens Studio MCP returned no parsable reply (HTTP {status})"}}
            write(reply)
    except Exception as e:  # keep the bridge alive; report per request
        if isinstance(msg, dict) and "id" in msg:
            write({"jsonrpc": "2.0", "id": msg["id"],
                   "error": {"code": -32603, "message": f"Lens Studio not reachable: {type(e).__name__}: {e}. Is Lens Studio open with this project?"}})


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        if isinstance(msg, list):
            for m in msg:
                threading.Thread(target=handle, args=(m,), daemon=True).start()
        elif msg.get("method") in ("initialize", "notifications/initialized"):
            handle(msg)  # keep handshake ordered
        else:
            threading.Thread(target=handle, args=(msg,), daemon=True).start()


if __name__ == "__main__":
    main()
