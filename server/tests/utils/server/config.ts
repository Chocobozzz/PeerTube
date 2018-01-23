import * as request from 'supertest'
import { makeDeleteRequest, makeGetRequest, makePutBodyRequest } from '../'
import { CustomConfig } from '../../../../shared/models/config/custom-config.model'

function getConfig (url: string) {
  const path = '/api/v1/config'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getCustomConfig (url: string, token: string, statusCodeExpected = 200) {
  const path = '/api/v1/config/custom'

  return makeGetRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function updateCustomConfig (url: string, token: string, newCustomConfig: CustomConfig, statusCodeExpected = 200) {
  const path = '/api/v1/config/custom'

  return makePutBodyRequest({
    url,
    token,
    path,
    fields: newCustomConfig,
    statusCodeExpected
  })
}

function deleteCustomConfig (url: string, token: string, statusCodeExpected = 200) {
  const path = '/api/v1/config/custom'

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  getConfig,
  getCustomConfig,
  updateCustomConfig,
  deleteCustomConfig
}
