import { Router } from 'express'

import type { Services } from '../services'
import mdtListRouter from './mdtList/mdtListRouter'

export default function routes(services: Services): Router {
  const router = Router()

  router.get('/', (_req, res) => res.redirect(302, '/mdt-list'))
  router.use('/mdt-list', mdtListRouter(services))

  return router
}
