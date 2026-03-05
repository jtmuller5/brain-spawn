import * as http from "http";
import { ClaudeMonitor } from "./claudeMonitor";

export class HookServer {
  private server: http.Server | undefined;
  private _port = 0;

  constructor(private readonly monitor: ClaudeMonitor) {}

  get port(): number {
    return this._port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method === "POST" && req.url === "/hooks") {
          this.handleHook(req, res);
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.server.on("error", reject);

      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (addr && typeof addr === "object") {
          this._port = addr.port;
        }
        resolve();
      });
    });
  }

  private handleHook(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const terminalId = req.headers["x-terminal-id"] as string | undefined;

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const event = JSON.parse(body);
        const resolvedId = terminalId || event.session_id || "unknown";

        this.monitor.handleHookEvent(resolvedId, event.session_id, event);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
  }

  dispose(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }
}
