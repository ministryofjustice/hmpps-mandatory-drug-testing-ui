import hasPermissionFilter from './hasPermissionFilter'

describe('hasPermissionFilter', () => {
  it.each([
    ['MANAGE', 'MANAGE', true],
    ['MANAGE', 'VIEW_ONLY', true],
    ['VIEW_ONLY', 'VIEW_ONLY', true],
    ['VIEW_ONLY', 'MANAGE', false],
    ['FORBIDDEN', 'VIEW_ONLY', false],
    ['FORBIDDEN', 'MANAGE', false],
  ] as const)('actual=%s required=%s → %s', (actual, required, expected) => {
    expect(hasPermissionFilter(actual, required)).toBe(expected)
  })

  it('returns false when no viewer permission is set', () => {
    expect(hasPermissionFilter(undefined, 'VIEW_ONLY')).toBe(false)
  })
})
