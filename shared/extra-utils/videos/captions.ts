import { expect } from 'chai'
import request from 'supertest'
import { HttpStatusCode } from '@shared/models'

async function testCaptionFile (url: string, captionPath: string, containsString: string) {
  const res = await request(url)
    .get(captionPath)
    .expect(HttpStatusCode.OK_200)

  expect(res.text).to.contain(containsString)
}

// ---------------------------------------------------------------------------

export {
  testCaptionFile
}
