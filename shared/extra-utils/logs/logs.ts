import { makeGetRequest } from '../requests/requests'
import { LogLevel } from '../../models/server/log-level.type'

function getLogs (url: string, accessToken: string, startDate: Date, endDate?: Date, level?: LogLevel) {
  const path = '/api/v1/server/logs'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: { startDate, endDate, level },
    statusCodeExpected: 200
  })
}

function getAuditLogs (url: string, accessToken: string, startDate: Date, endDate?: Date) {
  const path = '/api/v1/server/audit-logs'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: { startDate, endDate },
    statusCodeExpected: 200
  })
}

export {
  getLogs,
  getAuditLogs
}
