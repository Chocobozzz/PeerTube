import { makeGetRequest } from '../requests/requests'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'

function getDebug (url: string, token: string) {
  const path = '/api/v1/server/debug'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

// ---------------------------------------------------------------------------

export {
  getDebug
}
