export class Logger {
  private isDebug: boolean = false;

  setDebug(debug: boolean) {
    this.isDebug = debug;
  }

  log(message: string, ...optionalParams: any[]) {
    if (this.isDebug) {
      console.log(`[Analytics SDK] ${message}`, ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: any[]) {
    if (this.isDebug) {
      console.warn(`[Analytics SDK] ${message}`, ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: any[]) {
    if (this.isDebug) {
      console.error(`[Analytics SDK] ${message}`, ...optionalParams);
    }
  }
}

export const logger = new Logger();
