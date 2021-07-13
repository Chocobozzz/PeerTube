import * as request from 'supertest'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

// FIXME: delete once videos does not use it anymore
function xxxgetMyUserInformation (url: string, accessToken: string, specialStatus = HttpStatusCode.OK_200) {
  const path = '/api/v1/users/me'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(specialStatus)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  xxxgetMyUserInformation
}
