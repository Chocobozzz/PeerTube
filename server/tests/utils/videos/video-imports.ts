import { VideoImportCreate } from '../../../../shared/models/videos'
import { makeGetRequest, makePostBodyRequest } from '..'

function getYoutubeVideoUrl () {
  return 'https://youtu.be/msX3jv1XdvM'
}

function importVideo (url: string, token: string, attributes: VideoImportCreate) {
  const path = '/api/v1/videos/imports'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: attributes,
    statusCodeExpected: 200
  })
}

function getMyVideoImports (url: string, token: string) {
  const path = '/api/v1/users/me/videos/imports'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  getYoutubeVideoUrl,
  importVideo,
  getMyVideoImports
}
