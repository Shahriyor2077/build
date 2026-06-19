import pino, { Logger } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// In dev we prefer pretty output, but pino-pretty runs in a transport worker
// whose module resolution can fail in some runtimes. Fall back to plain JSON
// logging rather than crashing the process on boot.
function createLogger(): Logger {
  if (!isDev) return pino({ level: 'info' });
  try {
    return pino({
      level: 'debug',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  } catch {
    return pino({ level: 'debug' });
  }
}

export const logger = createLogger();
