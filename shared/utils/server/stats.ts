import { makeGetRequest } from '../requests/requests'

function getStats (url: string, useCache = false) {
  const path = '/api/v1/server/stats'

  const query = {
    t: useCache ? undefined : new Date().getTime()
  }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  getStats
}
