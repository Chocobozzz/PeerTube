import { makeRawRequest } from '../requests/requests'

function getPlaylist (url: string, statusCodeExpected = 200) {
  return makeRawRequest(url, statusCodeExpected)
}

function getSegment (url: string, statusCodeExpected = 200) {
  return makeRawRequest(url, statusCodeExpected)
}

function getSegmentSha256 (url: string, statusCodeExpected = 200) {
  return makeRawRequest(url, statusCodeExpected)
}

// ---------------------------------------------------------------------------

export {
  getPlaylist,
  getSegment,
  getSegmentSha256
}
