import type { Request, Response } from 'express'
import populateUserPermissions from './populateUserPermissions'

function build(roles: string[] | undefined) {
  const req = {} as Request
  const res = { locals: { user: roles === undefined ? undefined : { userRoles: roles } } } as unknown as Response
  const next = jest.fn()
  populateUserPermissions()(req, res, next)
  return { res, next }
}

describe('populateUserPermissions', () => {
  it('grants VIEW_ONLY for RO role', () => {
    const { res, next } = build(['MANDATORY_DRUG_TESTING_RO'])
    expect(res.locals.permissions).toBe('VIEW_ONLY')
    expect(next).toHaveBeenCalled()
  })

  it('grants MANAGE for RW role', () => {
    const { res } = build(['MANDATORY_DRUG_TESTING_RW'])
    expect(res.locals.permissions).toBe('MANAGE')
  })

  it('grants MANAGE for RWU role', () => {
    const { res } = build(['MANDATORY_DRUG_TESTING_RWU'])
    expect(res.locals.permissions).toBe('MANAGE')
  })

  it('prefers MANAGE over VIEW_ONLY when user holds both', () => {
    const { res } = build(['MANDATORY_DRUG_TESTING_RO', 'MANDATORY_DRUG_TESTING_RW'])
    expect(res.locals.permissions).toBe('MANAGE')
  })

  it('sets FORBIDDEN when no MDT role', () => {
    const { res } = build(['SOME_OTHER_ROLE'])
    expect(res.locals.permissions).toBe('FORBIDDEN')
  })

  it('sets FORBIDDEN when there is no user', () => {
    const { res } = build(undefined)
    expect(res.locals.permissions).toBe('FORBIDDEN')
  })
})
