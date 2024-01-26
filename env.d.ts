declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB1: D1Database;
      [key: string]: string | undefined;
    }
  }
}

export {};
