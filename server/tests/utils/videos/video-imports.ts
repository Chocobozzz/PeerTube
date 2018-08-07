import { VideoImportCreate } from '../../../../shared/models/videos'
import { makeGetRequest, makePostBodyRequest, makeUploadRequest } from '..'

function getYoutubeVideoUrl () {
  return 'https://youtu.be/msX3jv1XdvM'
}

function getMagnetURI () {
  // tslint:disable:max-line-length
  return 'magnet:?xs=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Ftorrents%2F2b8dbe74-9548-4f6f-a8da-986aed9e5e45-240.torrent&xt=urn:btih:52bf3729e5859390a8751495196b5674a55c99f3&dn=60fps_small&tr=wss%3A%2F%2Fpeertube2.cpy.re%3A443%2Ftracker%2Fsocket&tr=https%3A%2F%2Fpeertube2.cpy.re%2Ftracker%2Fannounce&ws=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Fwebseed%2F2b8dbe74-9548-4f6f-a8da-986aed9e5e45-240.mp4'
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
  getMagnetURI,
  getMyVideoImports
}
