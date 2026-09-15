import type { RedisClient } from '../redisClient'
import { CacheInterface } from './cacheInterface'

/**
 * Generic Redis-backed implementation of CacheInterface. Stores values as JSON
 * under the given key with the supplied TTL (in seconds).
 */
export default class RedisCache<T> implements CacheInterface<T> {
  constructor(private readonly client: RedisClient) {}

  private async ensureConnected(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect()
    }
  }

  async get(key: string): Promise<T | null> {
    await this.ensureConnected()
    const cached = (await this.client.get(key)) as string | null
    return cached ? (JSON.parse(cached) as T) : null
  }

  async set(key: string, value: T, durationSeconds: number): Promise<void> {
    await this.ensureConnected()
    await this.client.set(key, JSON.stringify(value), { EX: durationSeconds })
  }

  async clear(key: string): Promise<void> {
    await this.ensureConnected()
    await this.client.del(key)
  }
}
