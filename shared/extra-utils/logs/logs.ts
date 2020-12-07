import { makeGetRequest } from '../requests/requests'
import { LogLevel } from '../../models/server/log-level.type'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function getLogs (url: string, accessToken: string, startDate: Date, endDate?: Date, level?: LogLevel) {
  const path = '/api/v1/server/logs'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: { startDate, endDate, level },
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getAuditLogs (url: string, accessToken: string, startDate: Date, endDate?: Date) {
  const path = '/api/v1/server/audit-logs'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: { startDate, endDate },
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

export {
  getLogs,
  getAuditLogs
}
