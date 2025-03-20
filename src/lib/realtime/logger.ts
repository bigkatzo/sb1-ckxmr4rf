// Log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogOptions {
  samplingRate?: number; // Between 0 and 1
  context?: Record<string, any>;
}

class RealtimeLogger {
  private static instance: RealtimeLogger;
  private logLevel: LogLevel = 'info';
  private samplingRates: Record<LogLevel, number> = {
    error: 1, // Always log errors
    warn: 0.5, // Log 50% of warnings
    info: 0.1, // Log 10% of info
    debug: 0.01 // Log 1% of debug
  };

  private constructor() {}

  static getInstance(): RealtimeLogger {
    if (!this.instance) {
      this.instance = new RealtimeLogger();
    }
    return this.instance;
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel, samplingRate?: number): boolean {
    const levelOrder: Record<LogLevel, number> = {
      error: 3,
      warn: 2,
      info: 1,
      debug: 0
    };

    // Check if level is enabled
    if (levelOrder[level] < levelOrder[this.logLevel]) {
      return false;
    }

    // Apply sampling
    const rate = samplingRate ?? this.samplingRates[level];
    return Math.random() < rate;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  error(message: string, options?: LogOptions) {
    if (this.shouldLog('error', options?.samplingRate)) {
      console.error(this.formatMessage('error', message, options?.context));
    }
  }

  warn(message: string, options?: LogOptions) {
    if (this.shouldLog('warn', options?.samplingRate)) {
      console.warn(this.formatMessage('warn', message, options?.context));
    }
  }

  info(message: string, options?: LogOptions) {
    if (this.shouldLog('info', options?.samplingRate)) {
      console.log(this.formatMessage('info', message, options?.context));
    }
  }

  debug(message: string, options?: LogOptions) {
    if (this.shouldLog('debug', options?.samplingRate)) {
      console.debug(this.formatMessage('debug', message, options?.context));
    }
  }
}

export const logger = RealtimeLogger.getInstance();

// Set initial log level based on environment
if (process.env.NODE_ENV === 'production') {
  logger.setLogLevel('warn');
} else {
  logger.setLogLevel('debug');
} 