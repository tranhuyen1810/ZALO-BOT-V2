import fs from "fs";
import path from "path";

export class AppLogger {
  private readonly logDir = path.resolve(__dirname, "..", "..", "logs");

  constructor(private readonly fileName = "app.log") {}

  info(event: string, payload?: Record<string, unknown>): void {
    this.write("INFO", event, payload);
  }

  error(event: string, error: unknown, payload?: Record<string, unknown>): void {
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    this.write("ERROR", event, { ...payload, detail });
  }

  private write(level: string, event: string, payload?: Record<string, unknown>): void {
    fs.mkdirSync(this.logDir, { recursive: true });
    const line = [
      new Date().toISOString(),
      level,
      event,
      payload ? JSON.stringify(payload) : ""
    ].join(" ");
    fs.appendFileSync(path.join(this.logDir, this.fileName), `${line}\n`, "utf-8");
  }
}
