import { makeRawRequest } from '../requests/requests'
import { sha256 } from '../../../server/helpers/core-utils'
import { VideoStreamingPlaylist } from '../../models/videos/video-streaming-playlist.model'
import { expect } from 'chai'

function getPlaylist (url: string, statusCodeExpected = 200) {
  return makeRawRequest(url, statusCodeExpected)
}

function getSegment (url: string, statusCodeExpected = 200, range?: string) {
  return makeRawRequest(url, statusCodeExpected, range)
}

function getSegmentSha256 (url: string, statusCodeExpected = 200) {
  return makeRawRequest(url, statusCodeExpected)
}

async function checkSegmentHash (
  baseUrlPlaylist: string,
  baseUrlSegment: string,
  videoUUID: string,
  resolution: number,
  hlsPlaylist: VideoStreamingPlaylist
) {
  const res = await getPlaylist(`${baseUrlPlaylist}/${videoUUID}/${resolution}.m3u8`)
  const playlist = res.text

  const videoName = `${videoUUID}-${resolution}-fragmented.mp4`

  const matches = /#EXT-X-BYTERANGE:(\d+)@(\d+)/.exec(playlist)

  const length = parseInt(matches[1], 10)
  const offset = parseInt(matches[2], 10)
  const range = `${offset}-${offset + length - 1}`

  const res2 = await getSegment(`${baseUrlSegment}/${videoUUID}/${videoName}`, 206, `bytes=${range}`)

  const resSha = await getSegmentSha256(hlsPlaylist.segmentsSha256Url)

  const sha256Server = resSha.body[videoName][range]
  expect(sha256(res2.body)).to.equal(sha256Server)
}

// ---------------------------------------------------------------------------

export {
  getPlaylist,
  getSegment,
  getSegmentSha256,
  checkSegmentHash
}
