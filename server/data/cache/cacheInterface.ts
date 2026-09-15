export interface CacheInterface<T> {
  get(key: string): Promise<T | null>
  set(key: string, value: T, durationSeconds: number): Promise<void>
  clear(key: string): Promise<void>
}
