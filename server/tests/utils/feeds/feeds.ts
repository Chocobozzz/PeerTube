import * as request from 'supertest'
import { readFileBufferPromise } from '../../../helpers/core-utils'

function getXMLfeed (url: string, format?: string) {
  const path = '/feeds/videos.xml'

  return request(url)
          .get(path)
          .query((format) ? { format: format } : {})
          .set('Accept', 'application/xml')
          .expect(200)
          .expect('Content-Type', /xml/)
}

function getJSONfeed (url: string) {
  const path = '/feeds/videos.json'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getXMLfeed,
  getJSONfeed
}
