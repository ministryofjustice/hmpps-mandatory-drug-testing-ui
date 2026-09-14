import { AuthenticationClient, InMemoryTokenStore, RedisTokenStore } from '@ministryofjustice/hmpps-auth-clients'
import { createRedisClient } from './redisClient'
import { CacheInterface, InMemoryCache, RedisCache } from './cache'
import config from '../config'
import HmppsAuditClient from './hmppsAuditClient'
import logger from '../../logger'
import MandatoryDrugTestingApiClient from './mandatoryDrugTestingApiClient'
import applicationInfoSupplier from '../applicationInfo'

const applicationInfo = applicationInfoSupplier()

export const dataAccess = () => {
  const redisClient = config.redis.enabled ? createRedisClient() : null

  const hmppsAuthClient = new AuthenticationClient(
    config.apis.hmppsAuth,
    logger,
    redisClient ? new RedisTokenStore(redisClient) : new InMemoryTokenStore(),
  )

  const cacheStore = <T>(): CacheInterface<T> => (redisClient ? new RedisCache<T>(redisClient) : new InMemoryCache<T>())

  return {
    applicationInfo,
    hmppsAuthClient,
    mandatoryDrugTestingApiClient: new MandatoryDrugTestingApiClient(hmppsAuthClient),
    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),
    cacheStore,
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { AuthenticationClient, HmppsAuditClient, MandatoryDrugTestingApiClient }
