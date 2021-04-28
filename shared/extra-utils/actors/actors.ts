/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { makeGetRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function getActor (url: string, actorName: string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/actors/' + actorName

  return makeGetRequest({
    url,
    path,
    statusCodeExpected
  })
}

export {
  getActor
}
