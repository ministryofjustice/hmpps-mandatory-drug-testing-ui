export type NaturalKey = Array<string | number>

/**
 * Tokenises a location string into alternating string / number runs so that
 * "A-03-091" and "A-03-9" compare naturally: `["A-", 3, "-", 91]` vs `["A-", 3, "-", 9]`.
 * Non-digit runs are compared lexicographically (case-insensitive, en-GB);
 * digit runs are compared numerically. Shorter arrays sort before longer arrays after ties.
 */
export function toNaturalKey(input: string): NaturalKey {
  if (input == null) return ['']
  const key: NaturalKey = []
  const parts = input.match(/(\d+|[^\d]+)/g) ?? []
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      key.push(parseInt(part, 10))
    } else {
      key.push(part)
    }
  }
  return key
}

export default function naturalAlphanumericCompare(a: string, b: string): number {
  const ka = toNaturalKey(a)
  const kb = toNaturalKey(b)
  const len = Math.min(ka.length, kb.length)
  for (let i = 0; i < len; i += 1) {
    const va = ka[i]
    const vb = kb[i]
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return va - vb
    } else if (typeof va === 'string' && typeof vb === 'string') {
      const cmp = va.localeCompare(vb, 'en-GB', { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    } else {
      // Mixed type at this slot — numbers sort before strings so that "1abc" comes before "abc"
      return typeof va === 'number' ? -1 : 1
    }
  }
  return ka.length - kb.length
}
