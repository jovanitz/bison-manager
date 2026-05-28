/**
 * Logger contract.
 *
 * A *contract* (port), not an implementation. Any layer may depend on this type;
 * the composition root decides whether logs go to the console, a file, a remote
 * sink, or nowhere (in tests). Keeping it here in `shared` means even the domain
 * could accept a logger via parameters without taking a framework dependency.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

export type Logger = {
  readonly debug: (message: string, fields?: LogFields) => void;
  readonly info: (message: string, fields?: LogFields) => void;
  readonly warn: (message: string, fields?: LogFields) => void;
  readonly error: (message: string, fields?: LogFields) => void;
  /** Derive a child logger that always attaches the given fields. */
  readonly child: (fields: LogFields) => Logger;
};

/** A no-op logger, handy as a default and in tests. */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => noopLogger,
};

/**
 * A simple console-backed logger factory for development.
 *
 * `console` is reached through a minimally-typed `globalThis` so this module
 * compiles with neither the DOM nor the Node type libs — preserving the rule
 * that `shared` (and therefore `domain`) stays free of any environment lib.
 */
type ConsoleLike = Record<LogLevel, (message: string, fields: LogFields) => void>;

const consoleLike = (globalThis as unknown as { console: ConsoleLike }).console;

export const createConsoleLogger = (base: LogFields = {}): Logger => {
  const log =
    (level: LogLevel) => (message: string, fields: LogFields = {}) => {
      const payload = { ...base, ...fields };
      consoleLike[level](`[${level}] ${message}`, payload);
    };
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child: (fields) => createConsoleLogger({ ...base, ...fields }),
  };
};
