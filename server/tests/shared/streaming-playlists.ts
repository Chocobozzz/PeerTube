/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { basename } from 'path'
import { removeFragmentedMP4Ext, uuidRegex } from '@shared/core-utils'
import { sha256 } from '@shared/extra-utils'
import { HttpStatusCode, VideoStreamingPlaylist, VideoStreamingPlaylistType } from '@shared/models'
import { makeRawRequest, PeerTubeServer, webtorrentAdd } from '@shared/server-commands'
import { expectStartWith } from './checks'
import { hlsInfohashExist } from './tracker'

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

  const segmentBody = await command.getFragmentedSegment({
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

  const segmentBody = await command.getFragmentedSegment({ url: `${baseUrlSegment}/${videoUUID}/${segmentName}` })
  const shaBody = await command.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url })

  expect(sha256(segmentBody)).to.equal(shaBody[segmentName])
}

async function checkResolutionsInMasterPlaylist (options: {
  server: PeerTubeServer
  playlistUrl: string
  resolutions: number[]
  transcoded?: boolean // default true
  withRetry?: boolean // default false
}) {
  const { server, playlistUrl, resolutions, withRetry = false, transcoded = true } = options

  const masterPlaylist = await server.streamingPlaylists.get({ url: playlistUrl, withRetry })

  for (const resolution of resolutions) {
    const reg = transcoded
      ? new RegExp('#EXT-X-STREAM-INF:BANDWIDTH=\\d+,RESOLUTION=\\d+x' + resolution + ',(FRAME-RATE=\\d+,)?CODECS="avc1.64001f,mp4a.40.2"')
      : new RegExp('#EXT-X-STREAM-INF:BANDWIDTH=\\d+,RESOLUTION=\\d+x' + resolution + '')

    expect(masterPlaylist).to.match(reg)
  }

  const playlistsLength = masterPlaylist.split('\n').filter(line => line.startsWith('#EXT-X-STREAM-INF:BANDWIDTH='))
  expect(playlistsLength).to.have.lengthOf(resolutions.length)
}

async function completeCheckHlsPlaylist (options: {
  servers: PeerTubeServer[]
  videoUUID: string
  hlsOnly: boolean

  resolutions?: number[]
  objectStorageBaseUrl: string
}) {
  const { videoUUID, hlsOnly, objectStorageBaseUrl } = options

  const resolutions = options.resolutions ?? [ 240, 360, 480, 720 ]

  for (const server of options.servers) {
    const videoDetails = await server.videos.get({ id: videoUUID })
    const baseUrl = `http://${videoDetails.account.host}`

    expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)

    const hlsPlaylist = videoDetails.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    expect(hlsPlaylist).to.not.be.undefined

    const hlsFiles = hlsPlaylist.files
    expect(hlsFiles).to.have.lengthOf(resolutions.length)

    if (hlsOnly) expect(videoDetails.files).to.have.lengthOf(0)
    else expect(videoDetails.files).to.have.lengthOf(resolutions.length)

    // Check JSON files
    for (const resolution of resolutions) {
      const file = hlsFiles.find(f => f.resolution.id === resolution)
      expect(file).to.not.be.undefined

      expect(file.magnetUri).to.have.lengthOf.above(2)
      expect(file.torrentUrl).to.match(
        new RegExp(`${server.url}/lazy-static/torrents/${uuidRegex}-${file.resolution.id}-hls.torrent`)
      )

      if (objectStorageBaseUrl) {
        expectStartWith(file.fileUrl, objectStorageBaseUrl)
      } else {
        expect(file.fileUrl).to.match(
          new RegExp(`${baseUrl}/static/streaming-playlists/hls/${videoDetails.uuid}/${uuidRegex}-${file.resolution.id}-fragmented.mp4`)
        )
      }

      expect(file.resolution.label).to.equal(resolution + 'p')

      await makeRawRequest({ url: file.torrentUrl, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })

      const torrent = await webtorrentAdd(file.magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    }

    // Check master playlist
    {
      await checkResolutionsInMasterPlaylist({ server, playlistUrl: hlsPlaylist.playlistUrl, resolutions })

      const masterPlaylist = await server.streamingPlaylists.get({ url: hlsPlaylist.playlistUrl })

      let i = 0
      for (const resolution of resolutions) {
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)

        const url = 'http://' + videoDetails.account.host
        await hlsInfohashExist(url, hlsPlaylist.playlistUrl, i)

        i++
      }
    }

    // Check resolution playlists
    {
      for (const resolution of resolutions) {
        const file = hlsFiles.find(f => f.resolution.id === resolution)
        const playlistName = removeFragmentedMP4Ext(basename(file.fileUrl)) + '.m3u8'

        const url = objectStorageBaseUrl
          ? `${objectStorageBaseUrl}hls/${videoUUID}/${playlistName}`
          : `${baseUrl}/static/streaming-playlists/hls/${videoUUID}/${playlistName}`

        const subPlaylist = await server.streamingPlaylists.get({ url })

        expect(subPlaylist).to.match(new RegExp(`${uuidRegex}-${resolution}-fragmented.mp4`))
        expect(subPlaylist).to.contain(basename(file.fileUrl))
      }
    }

    {
      const baseUrlAndPath = objectStorageBaseUrl
        ? objectStorageBaseUrl + 'hls/' + videoUUID
        : baseUrl + '/static/streaming-playlists/hls/' + videoUUID

      for (const resolution of resolutions) {
        await checkSegmentHash({
          server,
          baseUrlPlaylist: baseUrlAndPath,
          baseUrlSegment: baseUrlAndPath,
          resolution,
          hlsPlaylist
        })
      }
    }
  }
}

export {
  checkSegmentHash,
  checkLiveSegmentHash,
  checkResolutionsInMasterPlaylist,
  completeCheckHlsPlaylist
}
