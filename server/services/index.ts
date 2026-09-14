import { dataAccess } from '../data'
import AuditService from './auditService'
import MandatoryDrugTestingService from './mandatoryDrugTestingService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, mandatoryDrugTestingApiClient, cacheStore } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    mandatoryDrugTestingService: new MandatoryDrugTestingService(mandatoryDrugTestingApiClient, cacheStore()),
  }
}

export type Services = ReturnType<typeof services>
