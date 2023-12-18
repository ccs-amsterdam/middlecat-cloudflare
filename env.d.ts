declare global {
  namespace NodeJS {
    interface ProcessEnv {
      KV: KVNamespace;
      DB1: D1Database;
      [key: string]: string | undefined;
    }
  }
}

export {};
