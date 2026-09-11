import { dataAccess } from '../data'
import AuditService from './auditService'
import MandatoryDrugTestingService from './mandatoryDrugTestingService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, mandatoryDrugTestingApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    mandatoryDrugTestingService: new MandatoryDrugTestingService(mandatoryDrugTestingApiClient),
  }
}

export type Services = ReturnType<typeof services>
