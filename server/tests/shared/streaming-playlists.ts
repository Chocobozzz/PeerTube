import { expect } from 'chai'
import { basename } from 'path'
import { removeFragmentedMP4Ext } from '@shared/core-utils'
import { sha256 } from '@shared/extra-utils'
import { HttpStatusCode, VideoStreamingPlaylist } from '@shared/models'
import { PeerTubeServer } from '@shared/server-commands'

async function checkSegmentHash (options: {
  server: PeerTubeServer
  baseUrlPlaylist: string
  baseUrlSegment: string
  resolution: number
  hlsPlaylist: VideoStreamingPlaylist
}) {
  const { server, baseUrlPlaylist, baseUrlSegment, resolution, hlsPlaylist } = options
  const command = server.streamingPlaylists

  const file = hlsPlaylist.files.find(f => f.resolution.id === resolution)
  const videoName = basename(file.fileUrl)

  const playlist = await command.get({ url: `${baseUrlPlaylist}/${removeFragmentedMP4Ext(videoName)}.m3u8` })

  const matches = /#EXT-X-BYTERANGE:(\d+)@(\d+)/.exec(playlist)

  const length = parseInt(matches[1], 10)
  const offset = parseInt(matches[2], 10)
  const range = `${offset}-${offset + length - 1}`

  const segmentBody = await command.getSegment({
    url: `${baseUrlSegment}/${videoName}`,
    expectedStatus: HttpStatusCode.PARTIAL_CONTENT_206,
    range: `bytes=${range}`
  })

  const shaBody = await command.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url })
  expect(sha256(segmentBody)).to.equal(shaBody[videoName][range])
}

async function checkLiveSegmentHash (options: {
  server: PeerTubeServer
  baseUrlSegment: string
  videoUUID: string
  segmentName: string
  hlsPlaylist: VideoStreamingPlaylist
}) {
  const { server, baseUrlSegment, videoUUID, segmentName, hlsPlaylist } = options
  const command = server.streamingPlaylists

  const segmentBody = await command.getSegment({ url: `${baseUrlSegment}/${videoUUID}/${segmentName}` })
  const shaBody = await command.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url })

  expect(sha256(segmentBody)).to.equal(shaBody[segmentName])
}

async function checkResolutionsInMasterPlaylist (options: {
  server: PeerTubeServer
  playlistUrl: string
  resolutions: number[]
}) {
  const { server, playlistUrl, resolutions } = options

  const masterPlaylist = await server.streamingPlaylists.get({ url: playlistUrl })

  for (const resolution of resolutions) {
    const reg = new RegExp(
      '#EXT-X-STREAM-INF:BANDWIDTH=\\d+,RESOLUTION=\\d+x' + resolution + ',(FRAME-RATE=\\d+,)?CODECS="avc1.64001f,mp4a.40.2"'
    )

    expect(masterPlaylist).to.match(reg)
  }

  const playlistsLength = masterPlaylist.split('\n').filter(line => line.startsWith('#EXT-X-STREAM-INF:BANDWIDTH='))
  expect(playlistsLength).to.have.lengthOf(resolutions.length)
}

export {
  checkSegmentHash,
  checkLiveSegmentHash,
  checkResolutionsInMasterPlaylist
}
