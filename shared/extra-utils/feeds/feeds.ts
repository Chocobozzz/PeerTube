import * as request from 'supertest'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

type FeedType = 'videos' | 'video-comments' | 'subscriptions'

function getXMLfeed (url: string, feed: FeedType, format?: string) {
  const path = '/feeds/' + feed + '.xml'

  return request(url)
          .get(path)
          .query((format) ? { format: format } : {})
          .set('Accept', 'application/xml')
          .expect(HttpStatusCode.OK_200)
          .expect('Content-Type', /xml/)
}

function getJSONfeed (url: string, feed: FeedType, query: any = {}, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/feeds/' + feed + '.json'

  return request(url)
          .get(path)
          .query(query)
          .set('Accept', 'application/json')
          .expect(statusCodeExpected)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getXMLfeed,
  getJSONfeed
}
