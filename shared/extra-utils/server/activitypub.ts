import * as request from 'supertest'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function makeActivityPubGetRequest (url: string, path: string, expectedStatus = HttpStatusCode.OK_200) {
  return request(url)
    .get(path)
    .set('Accept', 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8')
    .expect(expectedStatus)
}

// ---------------------------------------------------------------------------

export {
  makeActivityPubGetRequest
}
