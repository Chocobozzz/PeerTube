import * as request from 'supertest'

type FeedType = 'videos' | 'video-comments' | 'subscriptions'

function getXMLfeed (url: string, feed: FeedType, format?: string) {
  const path = '/feeds/' + feed + '.xml'

  return request(url)
          .get(path)
          .query((format) ? { format: format } : {})
          .set('Accept', 'application/xml')
          .expect(200)
          .expect('Content-Type', /xml/)
}

function getJSONfeed (url: string, feed: FeedType, query: any = {}, statusCodeExpected = 200) {
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
