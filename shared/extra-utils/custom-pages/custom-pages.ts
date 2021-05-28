import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { makeGetRequest, makePutBodyRequest } from '../requests/requests'

function getInstanceHomepage (url: string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/custom-pages/homepage/instance'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected
  })
}

function updateInstanceHomepage (url: string, token: string, content: string) {
  const path = '/api/v1/custom-pages/homepage/instance'

  return makePutBodyRequest({
    url,
    path,
    token,
    fields: { content },
    statusCodeExpected: HttpStatusCode.NO_CONTENT_204
  })
}

// ---------------------------------------------------------------------------

export {
  getInstanceHomepage,
  updateInstanceHomepage
}
