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
