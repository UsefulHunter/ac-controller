import { Client, PropertyMap } from 'gree-hvac-client';

export type ConnectionState = 'connecting' | 'online' | 'offline';

export interface AcSnapshot {
  connection: ConnectionState;
  deviceId: string | null;
  lastUpdate: number | null; // epoch ms da última resposta do aparelho
  properties: PropertyMap;
}

/** Valores aceitos para escrita, por propriedade. Validar aqui evita mandar lixo ao aparelho. */
export const WRITABLE: Record<string, string[] | { min: number; max: number }> = {
  power: ['on', 'off'],
  mode: ['auto', 'cool', 'dry', 'fan_only', 'heat'],
  fanSpeed: ['auto', 'low', 'mediumLow', 'medium', 'mediumHigh', 'high'],
  swingVert: [
    'default', 'full', 'fixedTop', 'fixedMidTop', 'fixedMid', 'fixedMidBottom', 'fixedBottom',
    'swingBottom', 'swingMidBottom', 'swingMid', 'swingMidTop', 'swingTop',
  ],
  swingHor: ['default', 'full', 'fixedLeft', 'fixedMidLeft', 'fixedMid', 'fixedMidRight', 'fixedRight'],
  turbo: ['on', 'off'],
  quiet: ['off', 'mode1', 'mode2', 'mode3'],
  sleep: ['on', 'off'],
  lights: ['on', 'off'],
  health: ['on', 'off'],
  powerSave: ['on', 'off'],
  blow: ['on', 'off'],
  temperature: { min: 16, max: 30 },
};

export class AcDevice {
  private client: Client;
  private state: AcSnapshot = {
    connection: 'connecting',
    deviceId: null,
    lastUpdate: null,
    properties: {},
  };
  private listeners = new Set<(s: AcSnapshot) => void>();

  constructor(host: string, pollingInterval: number) {
    this.client = new Client({
      host,
      pollingInterval,
      pollingTimeout: Math.min(1500, pollingInterval),
      logLevel: 'error',
    });

    this.client.on('connect', () => {
      this.patch({ connection: 'online', deviceId: this.client.getDeviceId(), lastUpdate: Date.now() });
    });
    // 'update' = mudança detectada no aparelho (controle remoto, app, botão físico...)
    // 'success' = nossa escrita foi aceita
    const merge = (_updated: PropertyMap, all: PropertyMap) =>
      this.patch({ connection: 'online', lastUpdate: Date.now(), properties: { ...all } });
    this.client.on('update', merge);
    this.client.on('success', merge);
    this.client.on('no_response', () => this.patch({ connection: 'offline' }));
    this.client.on('disconnect', () => this.patch({ connection: 'offline' }));
    this.client.on('error', (err: Error) => {
      console.error(`[gree] ${err.name}: ${err.message}`);
    });
  }

  get snapshot(): AcSnapshot {
    return this.state;
  }

  subscribe(fn: (s: AcSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Valida e envia. Retorna os campos rejeitados, se houver. */
  async set(input: Record<string, unknown>): Promise<void> {
    const out: PropertyMap = {};
    for (const [key, value] of Object.entries(input)) {
      const rule = WRITABLE[key];
      if (!rule) throw new Error(`Propriedade não permitida: ${key}`);
      if (Array.isArray(rule)) {
        if (typeof value !== 'string' || !rule.includes(value)) {
          throw new Error(`Valor inválido para ${key}: ${String(value)}`);
        }
        out[key] = value;
      } else {
        const n = Number(value);
        if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
          throw new Error(`${key} deve ser inteiro entre ${rule.min} e ${rule.max}`);
        }
        out[key] = n;
      }
    }
    if (Object.keys(out).length === 0) throw new Error('Nenhuma propriedade enviada');
    if (out.temperature !== undefined) out.temperatureUnit = 'celsius';
    await this.client.setProperties(out);
  }

  async close(): Promise<void> {
    await this.client.disconnect().catch(() => undefined);
  }

  private patch(partial: Partial<AcSnapshot>) {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn(this.state);
  }
}
