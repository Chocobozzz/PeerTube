import { makeDeleteRequest, makeGetRequest, makeUploadRequest } from '../requests/requests'
import * as request from 'supertest'
import * as chai from 'chai'
import { buildAbsoluteFixturePath } from '../miscs/miscs'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const expect = chai.expect

function createVideoCaption (args: {
  url: string
  accessToken: string
  videoId: string | number
  language: string
  fixture: string
  mimeType?: string
  statusCodeExpected?: number
}) {
  const path = '/api/v1/videos/' + args.videoId + '/captions/' + args.language

  const captionfile = buildAbsoluteFixturePath(args.fixture)
  const captionfileAttach = args.mimeType ? [ captionfile, { contentType: args.mimeType } ] : captionfile

  return makeUploadRequest({
    method: 'PUT',
    url: args.url,
    path,
    token: args.accessToken,
    fields: {},
    attaches: {
      captionfile: captionfileAttach
    },
    statusCodeExpected: args.statusCodeExpected || HttpStatusCode.NO_CONTENT_204
  })
}

function listVideoCaptions (url: string, videoId: string | number) {
  const path = '/api/v1/videos/' + videoId + '/captions'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function deleteVideoCaption (url: string, token: string, videoId: string | number, language: string) {
  const path = '/api/v1/videos/' + videoId + '/captions/' + language

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected: HttpStatusCode.NO_CONTENT_204
  })
}

async function testCaptionFile (url: string, captionPath: string, containsString: string) {
  const res = await request(url)
    .get(captionPath)
    .expect(HttpStatusCode.OK_200)

  expect(res.text).to.contain(containsString)
}

// ---------------------------------------------------------------------------

export {
  createVideoCaption,
  listVideoCaptions,
  testCaptionFile,
  deleteVideoCaption
}
