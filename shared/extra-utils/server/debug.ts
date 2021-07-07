import { makeGetRequest, makePostBodyRequest } from '../requests/requests'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { SendDebugCommand } from '@shared/models'

function getDebug (url: string, token: string) {
  const path = '/api/v1/server/debug'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function sendDebugCommand (url: string, token: string, body: SendDebugCommand) {
  const path = '/api/v1/server/debug/run-command'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: body,
    statusCodeExpected: HttpStatusCode.NO_CONTENT_204
  })
}

// ---------------------------------------------------------------------------

export {
  getDebug,
  sendDebugCommand
}
