import naturalAlphanumericCompare, { toNaturalKey } from './naturalAlphanumericCompare'

function sorted(values: string[]) {
  return [...values].sort(naturalAlphanumericCompare)
}

describe('naturalAlphanumericCompare', () => {
  it('sorts "A-03-9" before "A-03-091"', () => {
    expect(naturalAlphanumericCompare('A-03-9', 'A-03-091')).toBeLessThan(0)
  })

  it('sorts "RECP" after "A-01-001"', () => {
    expect(naturalAlphanumericCompare('A-01-001', 'RECP')).toBeLessThan(0)
  })

  it('sorts prison locations naturally end-to-end', () => {
    expect(sorted(['A-03-091', 'A-03-9', 'A-01-001', 'RECP', '1-3-037', 'A-03-10'])).toEqual([
      '1-3-037',
      'A-01-001',
      'A-03-9',
      'A-03-10',
      'A-03-091',
      'RECP',
    ])
  })

  it('is case-insensitive', () => {
    expect(naturalAlphanumericCompare('a-01-001', 'A-01-001')).toBe(0)
  })

  it('handles empty strings', () => {
    expect(naturalAlphanumericCompare('', '')).toBe(0)
    expect(naturalAlphanumericCompare('', 'A')).toBeLessThan(0)
  })

  it('handles a single token', () => {
    expect(naturalAlphanumericCompare('RECP', 'RECP')).toBe(0)
    expect(naturalAlphanumericCompare('RECP', 'RECB')).toBeGreaterThan(0)
  })

  it('tokenises expected shapes', () => {
    expect(toNaturalKey('A-03-091')).toEqual(['A-', 3, '-', 91])
    expect(toNaturalKey('A-03-9')).toEqual(['A-', 3, '-', 9])
    expect(toNaturalKey('1-3-037')).toEqual([1, '-', 3, '-', 37])
    expect(toNaturalKey('RECP')).toEqual(['RECP'])
  })
})
