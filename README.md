# camofox-browser (Pinokio launcher)

A 1-click Pinokio launcher for [jo-inc/camofox-browser](https://github.com/jo-inc/camofox-browser).

## What it does

**camofox-browser** is a stealth headless browser server built for AI agents. It wraps
[Camoufox](https://camoufox.com/) — a Firefox fork with C++-level fingerprint spoofing — behind a
plain REST API, so an agent can drive a real browser that bypasses Cloudflare, Google, and most
commercial bot detection.

What makes it useful for agents specifically:

- **Accessibility snapshots instead of HTML.** `GET /tabs/:id/snapshot` returns a compact indented
  tree (`- link "Learn more" [e1]`) that is far smaller than raw HTML, so a whole page fits in a
  context window.
- **Element refs.** You click `e1` rather than guessing a CSS selector that changes on every deploy.
- **Session isolation.** Each `userId` gets its own browser context, cookies, and storage.
- **Search macros.** `@google_search`, `@amazon_search`, and friends handle the SERP quirks for you.
- **Extras.** Proxy + GeoIP support, cookie import/export in Netscape format, YouTube transcript
  extraction, Playwright traces, and Prometheus metrics.

This launcher installs it, starts it on a free port bound to loopback, and gives you a one-click
link to the interactive API docs.

## Requirements

Handled for you by Pinokio — listed only so you know what is being used:

- **Node.js >= 22** — Pinokio ships Node 24, so nothing extra is installed.
- **~300 MB of disk** for the Camoufox browser binary, plus ~200 MB for `node_modules`.
- Works on Windows, macOS, and Linux. On Linux the server additionally uses Xvfb for a virtual
  display; on Windows and macOS it runs fully headless.

## How to use

| Tab | What it does |
|---|---|
| **Install** | Clones the repo into `app/`, runs `npm install`, and downloads the Camoufox browser binary. First run takes a few minutes. |
| **Start** | Launches the server. When it is up, an **Open Web UI** tab appears. |
| **Open Web UI** | Opens the interactive API documentation at `/docs`. |
| **Update** | Pulls the latest launcher and app code, then re-installs dependencies. |
| **Reset** | Deletes `app/` so you can install from scratch. |

To stop the server, use Pinokio's built-in stop control on the running script — there is no separate
stop script.

### Finding your port

The launcher does **not** use the upstream default port 9377. Pinokio assigns the next free port at
launch so this app never collides with anything else you are running. The actual port appears:

- in the **Open Web UI** link (`http://127.0.0.1:<port>/docs/`), and
- in the terminal, in the startup log line:

```json
{"ts":"...","level":"info","msg":"server started","port":54321,"host":"127.0.0.1","pid":1234}
```

Every example below uses `<port>` — substitute the real one.

### Useful endpoints

- `GET /` — status JSON (`ok`, `browserConnected`, …)
- `GET /health` — health check
- `GET /docs` — interactive API documentation
- `GET /openapi.json` — the OpenAPI spec
- `GET /metrics` — Prometheus metrics

## Configuration

Pinokio automatically imports the launcher's `ENVIRONMENT` file into every script. Edit it from the
**Configure** tab — no need to touch the scripts.

| Variable | Default here | Purpose |
|---|---|---|
| `CAMOFOX_CRASH_REPORT_ENABLED` | `false` | **Telemetry.** Upstream defaults this to on, which posts anonymized crash/hang reports to a third-party endpoint that auto-files GitHub issues. This launcher turns it **off**. Set to `true` to opt back in. |
| `CAMOFOX_ACCESS_KEY` | unset | Bearer token required on protected routes. Unset means no auth (fine for loopback-only). |
| `CAMOFOX_API_KEY` | unset | Enables the cookie import endpoint. The endpoint is disabled while unset. |
| `CAMOFOX_ADMIN_KEY` | unset | Required for `POST /stop`. |
| `MAX_SESSIONS` | `50` | Maximum concurrent sessions. |
| `SESSION_TIMEOUT_MS` | `1800000` | Inactivity timeout (30 minutes). |
| `PROXY_HOST` / `PROXY_PORT` | unset | Upstream proxy for the browser. |

`CAMOFOX_PORT` and `CAMOFOX_BIND_HOST` are set by `start.js` and should not be overridden — the port
comes from Pinokio's allocator and the bind host is pinned to `127.0.0.1`.

> **Note on binding.** Upstream defaults to an empty bind host, which makes Express listen on
> `0.0.0.0` (every network interface). This launcher pins it to `127.0.0.1` so the browser API is
> not reachable from your network.

## API

All examples assume the server is running on `<port>`. The `userId` field scopes the browser session —
use a stable string per agent.

### Curl

```bash
# 1. Create a tab
curl -X POST http://127.0.0.1:<port>/tabs \
  -H 'Content-Type: application/json' \
  -d '{"userId": "agent1", "sessionKey": "task1", "url": "https://example.com"}'
# -> {"tabId":"a41948e3-...","url":"https://example.com/"}

# 2. Read the page as an accessibility snapshot with element refs
curl "http://127.0.0.1:<port>/tabs/TAB_ID/snapshot?userId=agent1"
# -> {
#      "url": "https://example.com/",
#      "snapshot": "- heading \"Example Domain\" [level=1]\n- paragraph: This domain is for use in
#                   documentation examples...\n- paragraph:\n  - link \"Learn more\" [e1]:\n
#                   - /url: https://iana.org/domains/example",
#      "refsCount": 1, "truncated": false, "totalChars": 237
#    }
# Interactive elements carry a [eN] ref -- that is what you pass to /click and /type.

# 3. Click an element by ref
curl -X POST http://127.0.0.1:<port>/tabs/TAB_ID/click \
  -H 'Content-Type: application/json' \
  -d '{"userId": "agent1", "ref": "e1"}'

# 4. Type into an element
curl -X POST http://127.0.0.1:<port>/tabs/TAB_ID/type \
  -H 'Content-Type: application/json' \
  -d '{"userId": "agent1", "ref": "e2", "text": "hello", "pressEnter": true}'

# 5. Navigate using a search macro
curl -X POST http://127.0.0.1:<port>/tabs/TAB_ID/navigate \
  -H 'Content-Type: application/json' \
  -d '{"userId": "agent1", "macro": "@google_search", "query": "best coffee beans"}'

# 6. Clean up
curl -X DELETE http://127.0.0.1:<port>/tabs/TAB_ID
curl -X DELETE http://127.0.0.1:<port>/sessions/agent1
```

If you set `CAMOFOX_ACCESS_KEY`, add `-H "Authorization: Bearer $CAMOFOX_ACCESS_KEY"` to each call.

### JavaScript

```javascript
const BASE = "http://127.0.0.1:<port>";
const USER = "agent1";

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Open a page
const { tabId } = await api("/tabs", {
  method: "POST",
  body: { userId: USER, sessionKey: "task1", url: "https://example.com" },
});

// Read it
const { snapshot, refsCount } = await api(`/tabs/${tabId}/snapshot?userId=${USER}`);
console.log(snapshot);   // '- heading "Example Domain" [level=1]\n- link "Learn more" [e1]: ...'
console.log(refsCount);  // 1

// Interact
await api(`/tabs/${tabId}/type`, {
  method: "POST",
  body: { userId: USER, ref: "e2", text: "hello", pressEnter: true },
});
await api(`/tabs/${tabId}/click`, {
  method: "POST",
  body: { userId: USER, ref: "e1" },
});

// Clean up
await api(`/tabs/${tabId}`, { method: "DELETE" });
```

### Python

```python
import requests

BASE = "http://127.0.0.1:<port>"
USER = "agent1"


def api(path, method="GET", **body):
    res = requests.request(method, f"{BASE}{path}", json=body or None, timeout=120)
    res.raise_for_status()
    return res.json()


# Open a page
tab = api("/tabs", "POST", userId=USER, sessionKey="task1", url="https://example.com")
tab_id = tab["tabId"]

# Read it
snapshot = api(f"/tabs/{tab_id}/snapshot?userId={USER}")["snapshot"]
print(snapshot)  # '- heading "Example Domain" [level=1]\n- link "Learn more" [e1]: ...'

# Interact
api(f"/tabs/{tab_id}/type", "POST", userId=USER, ref="e2", text="hello", pressEnter=True)
api(f"/tabs/{tab_id}/click", "POST", userId=USER, ref="e1")

# Search macro
api(f"/tabs/{tab_id}/navigate", "POST", userId=USER,
    macro="@google_search", query="best coffee beans")

# Clean up
api(f"/tabs/{tab_id}", "DELETE")
api(f"/sessions/{USER}", "DELETE")
```

### Full endpoint reference

The complete, always-current reference is served by the app itself:

- Interactive docs: `http://127.0.0.1:<port>/docs/`
- OpenAPI spec: `http://127.0.0.1:<port>/openapi.json`

## Using it as an MCP server

The app also ships a Model Context Protocol server (stdio transport) that exposes the browser as
tools to any MCP-compatible client. It is a thin client over the REST API, so **the Pinokio
`start.js` script must be running** for it to work.

Add this to your MCP client config, substituting the real port:

```json
{
  "mcpServers": {
    "camofox-browser": {
      "command": "node",
      "args": ["C:\\pinokio\\api\\camofox-browser-pinokio\\app\\mcp\\server.mjs"],
      "env": {
        "CAMOFOX_BASE_URL": "http://127.0.0.1:<port>"
      }
    }
  }
}
```

On macOS/Linux use the POSIX path instead, e.g.
`~/pinokio/api/camofox-browser-pinokio/app/mcp/server.mjs`.

> **If your MCP client reports "node: not found":** the client is not inheriting a Node on `PATH`.
> Pinokio bundles one — point `command` at it directly instead:
> `C:\pinokio\bin\miniforge\node.exe` on Windows, or `<PINOKIO_HOME>/bin/miniforge/bin/node` on
> macOS/Linux. Requires Node 22+, which the bundled runtime satisfies.

Verified working: the server reports
`[camofox-browser-mcp] v1.13.1 connected → http://127.0.0.1:<port>` on stderr and returns all 11
tools below.

Tools exposed: `camofox_create_tab`, `camofox_snapshot`, `camofox_click`, `camofox_type`,
`camofox_navigate`, `camofox_scroll`, `camofox_screenshot`, `camofox_close_tab`,
`camofox_evaluate`, `camofox_list_tabs`, `camofox_import_cookies`.

## Troubleshooting

**The Open Web UI tab never appears.** The server prints structured JSON logs, and the launcher
waits for its `"msg":"server started"` line. Check the terminal — if you see
`browser pre-warm aborted: Camoufox binaries are not installed`, the browser binary did not
download. Re-run **Install**, or run `npx camoufox-js fetch` inside `app/`.

**Port already in use.** Should not happen — Pinokio allocates a free port each launch. If you see
`{"level":"error","msg":"port in use"}`, stop the script and start it again.

**Reset did not free much disk space.** `Reset` removes `app/`, but the Camoufox browser binary
lives in a shared OS cache outside this folder and is left in place on purpose — it is ~300 MB and
slow to re-download. To remove it manually:

| OS | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\camoufox\camoufox\Cache` |
| macOS | `~/Library/Caches/camoufox` |
| Linux | `~/.cache/camoufox` |

**Requests are slow on the first call.** The server pre-warms the browser at startup, but a cold
Camoufox launch takes 6–7 seconds. Subsequent calls reuse it.

## Credits

- Upstream project: [jo-inc/camofox-browser](https://github.com/jo-inc/camofox-browser) (MIT), by Jo Inc.
- Browser engine: [Camoufox](https://camoufox.com/).
- This folder contains only the Pinokio launcher scripts; the app itself is cloned into `app/` at
  install time and is not modified.

## License

The `LICENSE` file in this repository (MIT) covers **the Pinokio launcher scripts only** —
`install.js`, `start.js`, `reset.js`, `update.js`, `pinokio.js`, and this documentation.

camofox-browser itself is separately licensed by its authors and ships its own MIT `LICENSE`
inside `app/` after installation. Camoufox and the browser binary carry their own upstream terms.
