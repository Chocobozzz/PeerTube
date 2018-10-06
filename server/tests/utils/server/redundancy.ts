import { makePutBodyRequest } from '../requests/requests'

async function updateRedundancy (url: string, accessToken: string, host: string, redundancyAllowed: boolean, expectedStatus = 204) {
  const path = '/api/v1/server/redundancy/' + host

  return makePutBodyRequest({
    url,
    path,
    token: accessToken,
    fields: { redundancyAllowed },
    statusCodeExpected: expectedStatus
  })
}

export {
  updateRedundancy
}
