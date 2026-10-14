declare module 'gree-hvac-client' {
  import { EventEmitter } from 'events';

  export type PropertyMap = Record<string, string | number>;

  export interface ClientOptions {
    host?: string;
    port?: number;
    connectTimeout?: number;
    autoConnect?: boolean;
    poll?: boolean;
    pollingInterval?: number;
    pollingTimeout?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  }

  export class Client extends EventEmitter {
    constructor(options?: ClientOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    setProperties(properties: PropertyMap): Promise<void>;
    setProperty(property: string, value: string | number): Promise<void>;
    getDeviceId(): string | null;
    on(event: 'connect', listener: () => void): this;
    on(event: 'disconnect', listener: () => void): this;
    on(event: 'no_response', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'update' | 'success', listener: (updated: PropertyMap, all: PropertyMap) => void): this;
  }
  export const PROPERTY: Record<string, string>;
  export const VALUE: Record<string, Record<string, string>>;
}
