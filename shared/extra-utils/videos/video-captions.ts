import { makeDeleteRequest, makeGetRequest, makeUploadRequest } from '../requests/requests'
import * as request from 'supertest'
import * as chai from 'chai'
import { buildAbsoluteFixturePath } from '../miscs/miscs'

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
    statusCodeExpected: args.statusCodeExpected || 204
  })
}

function listVideoCaptions (url: string, videoId: string | number) {
  const path = '/api/v1/videos/' + videoId + '/captions'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function deleteVideoCaption (url: string, token: string, videoId: string | number, language: string) {
  const path = '/api/v1/videos/' + videoId + '/captions/' + language

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected: 204
  })
}

async function testCaptionFile (url: string, captionPath: string, containsString: string) {
  const res = await request(url)
    .get(captionPath)
    .expect(200)

  expect(res.text).to.contain(containsString)
}

// ---------------------------------------------------------------------------

export {
  createVideoCaption,
  listVideoCaptions,
  testCaptionFile,
  deleteVideoCaption
}
