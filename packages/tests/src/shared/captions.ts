import { HttpStatusCode } from '@peertube/peertube-models'
import { makeRawRequest } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

export async function testCaptionFile (fileUrl: string, toTest: RegExp | string) {
  const res = await makeRawRequest({ url: fileUrl, expectedStatus: HttpStatusCode.OK_200 })

  if (toTest instanceof RegExp) {
    expect(res.text).to.match(toTest)
  } else {
    expect(res.text).to.contain(toTest)
  }
}
