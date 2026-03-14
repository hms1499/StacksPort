type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: object): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  };
  const out = level === "error" ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + "\n");
}

export const log = {
  info:  (message: string, meta?: object) => write("info",  message, meta),
  warn:  (message: string, meta?: object) => write("warn",  message, meta),
  error: (message: string, meta?: object) => write("error", message, meta),
};
