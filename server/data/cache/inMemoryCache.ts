import { CacheInterface } from './cacheInterface'

/**
 * Generic in-memory implementation of CacheInterface, keyed with a per-entry expiry.
 * Used as a fallback when Redis is disabled (e.g. local development/tests).
 */
export default class InMemoryCache<T> implements CacheInterface<T> {
  cache = new Map<string, { data: T; expiry: Date }>()

  async get(key: string): Promise<T | null> {
    const cached = this.cache.get(key)
    if (cached && cached.expiry.getTime() > new Date().getTime()) {
      return cached.data
    }
    return null
  }

  async set(key: string, value: T, durationSeconds: number): Promise<void> {
    this.cache.set(key, { data: value, expiry: new Date(Date.now() + durationSeconds * 1000) })
  }

  async clear(key: string): Promise<void> {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
  }
}
