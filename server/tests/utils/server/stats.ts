import { makeGetRequest } from '../'

function getStats (url: string) {
  const path = '/api/v1/server/stats'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  getStats
}
