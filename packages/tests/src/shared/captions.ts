import { expect } from 'chai'
import request from 'supertest'
import { HttpStatusCode } from '@peertube/peertube-models'

async function testCaptionFile (url: string, captionPath: string, toTest: RegExp | string) {
  const res = await request(url)
    .get(captionPath)
    .expect(HttpStatusCode.OK_200)

  if (toTest instanceof RegExp) {
    expect(res.text).to.match(toTest)
  } else {
    expect(res.text).to.contain(toTest)
  }
}

// ---------------------------------------------------------------------------

export {
  testCaptionFile
}
