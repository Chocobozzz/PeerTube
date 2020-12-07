import { makeGetRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function getStats (url: string, useCache = false) {
  const path = '/api/v1/server/stats'

  const query = {
    t: useCache ? undefined : new Date().getTime()
  }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

// ---------------------------------------------------------------------------

export {
  getStats
}
