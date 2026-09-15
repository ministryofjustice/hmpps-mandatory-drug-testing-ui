import { toNaturalKey } from './naturalAlphanumericCompare'

describe('toNaturalKey', () => {
  it('tokenises location codes with numeric and string parts', () => {
    expect(toNaturalKey('A-03-091')).toEqual(['A-', 3, '-', 91])
    expect(toNaturalKey('A-03-9')).toEqual(['A-', 3, '-', 9])
    expect(toNaturalKey('1-3-037')).toEqual([1, '-', 3, '-', 37])
  })

  it('tokenises single string tokens', () => {
    expect(toNaturalKey('RECP')).toEqual(['RECP'])
  })

  it('handles empty strings', () => {
    expect(toNaturalKey('')).toEqual([])
  })
})
