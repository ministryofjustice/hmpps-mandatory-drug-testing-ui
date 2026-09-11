import type { Request, Response } from 'express'
import requirePermissions from './requirePermissions'

function build(permissions: string | undefined) {
  const req = {} as Request
  const render = jest.fn()
  const status = jest.fn(() => ({ render }))
  const res = { locals: { permissions }, status } as unknown as Response
  const next = jest.fn()
  return { req, res, next, render, status }
}

describe('requirePermissions', () => {
  it('calls next when permission is in allowed list', () => {
    const { req, res, next } = build('MANAGE')
    requirePermissions('VIEW_ONLY', 'MANAGE')(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('calls next for VIEW_ONLY when allowed', () => {
    const { req, res, next } = build('VIEW_ONLY')
    requirePermissions('VIEW_ONLY', 'MANAGE')(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('renders 403 when permission is FORBIDDEN', () => {
    const { req, res, next, status, render } = build('FORBIDDEN')
    requirePermissions('VIEW_ONLY', 'MANAGE')(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(403)
    expect(render).toHaveBeenCalledWith('pages/notAuthorised')
  })

  it('renders 500 when permissions missing on locals', () => {
    const { req, res, next, status, render } = build(undefined)
    requirePermissions('VIEW_ONLY', 'MANAGE')(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(500)
    expect(render).toHaveBeenCalledWith('pages/error')
  })

  it('renders 403 when permission not in allowed list', () => {
    const { req, res, next, status } = build('VIEW_ONLY')
    requirePermissions('MANAGE')(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(403)
  })
})
