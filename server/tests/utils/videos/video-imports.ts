import { VideoImportCreate } from '../../../../shared/models/videos'
import { makeGetRequest, makeUploadRequest } from '..'

function getYoutubeVideoUrl () {
  return 'https://youtu.be/msX3jv1XdvM'
}

function getMagnetURI () {
  // tslint:disable:max-line-length
  return 'magnet:?xs=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Ftorrents%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.torrent&xt=urn:btih:0f498834733e8057ed5c6f2ee2b4efd8d84a76ee&dn=super+peertube2+video&tr=wss%3A%2F%2Fpeertube2.cpy.re%3A443%2Ftracker%2Fsocket&tr=https%3A%2F%2Fpeertube2.cpy.re%2Ftracker%2Fannounce&ws=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Fwebseed%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.mp4'
}

function importVideo (url: string, token: string, attributes: VideoImportCreate) {
  const path = '/api/v1/videos/imports'

  let attaches: any = {}
  if (attributes.torrentfile) attaches = { torrentfile: attributes.torrentfile }

  return makeUploadRequest({
    url,
    path,
    token,
    attaches,
    fields: attributes,
    statusCodeExpected: 200
  })
}

function getMyVideoImports (url: string, token: string, sort?: string) {
  const path = '/api/v1/users/me/videos/imports'

  const query = {}
  if (sort) query['sort'] = sort

  return makeGetRequest({
    url,
    query,
    path,
    token,
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  getYoutubeVideoUrl,
  importVideo,
  getMagnetURI,
  getMyVideoImports
}
