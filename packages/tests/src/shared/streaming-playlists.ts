/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS, removeFragmentedMP4Ext, uuidRegex } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  VideoDetails,
  VideoPrivacy,
  VideoResolution,
  VideoStreamingPlaylist,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { sha1, sha256 } from '@peertube/peertube-node-utils'
import { makeRawRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { basename, dirname, join } from 'path'
import { expectStartWith } from './checks.js'
import { SQLCommand } from './sql-command.js'
import { hlsInfohashExist } from './tracker.js'
import { checkWebTorrentWorks } from './webtorrent.js'

export async function checkSegmentHash (options: {
  server: PeerTubeServer
  baseUrlPlaylist: string
  baseUrlSegment: string
  resolution: number
  hlsPlaylist: VideoStreamingPlaylist
  token?: string
}) {
  const { server, baseUrlPlaylist, baseUrlSegment, resolution, hlsPlaylist, token } = options
  const command = server.streamingPlaylists

  const file = hlsPlaylist.files.find(f => f.resolution.id === resolution)
  const videoName = basename(file.fileUrl)

  const playlist = await command.get({ url: `${baseUrlPlaylist}/${removeFragmentedMP4Ext(videoName)}.m3u8`, token })

  const matches = /#EXT-X-BYTERANGE:(\d+)@(\d+)/.exec(playlist)

  const length = parseInt(matches[1], 10)
  const offset = parseInt(matches[2], 10)
  const range = `${offset}-${offset + length - 1}`

  const segmentBody = await command.getFragmentedSegment({
    url: `${baseUrlSegment}/${videoName}`,
    expectedStatus: HttpStatusCode.PARTIAL_CONTENT_206,
    range: `bytes=${range}`,
    token
  })

  const shaBody = await command.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url, token })
  expect(sha256(segmentBody)).to.equal(shaBody[videoName][range], `Invalid sha256 result for ${videoName} range ${range}`)
}

export async function checkLiveSegmentHash (options: {
  server: PeerTubeServer
  baseUrlSegment: string
  videoUUID: string
  segmentName: string
  hlsPlaylist: VideoStreamingPlaylist
  withRetry?: boolean
}) {
  const { server, baseUrlSegment, videoUUID, segmentName, hlsPlaylist, withRetry = false } = options
  const command = server.streamingPlaylists

  const segmentBody = await command.getFragmentedSegment({ url: `${baseUrlSegment}/${videoUUID}/${segmentName}`, withRetry })
  const shaBody = await command.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url, withRetry })

  expect(sha256(segmentBody)).to.equal(shaBody[segmentName])
}

export async function checkPlaylistInfohash (options: {
  video: VideoDetails
  sqlCommand: SQLCommand
  files: unknown[]
}) {
  const { sqlCommand, video, files } = options
  const hls = getHLS(video)

  for (let i = 0; i < files.length; i++) {
    const infohash = sha1(`${2 + hls.playlistUrl}+V${i}`)
    const dbInfohashes = await sqlCommand.getPlaylistInfohash(hls.id)

    expect(dbInfohashes).to.include(infohash)
  }
}

// ---------------------------------------------------------------------------

export async function checkResolutionsInMasterPlaylist (options: {
  server: PeerTubeServer
  playlistUrl: string
  resolutions: number[]
  token?: string
  transcoded?: boolean // default true
  withRetry?: boolean // default false
  splittedAudio?: boolean // default false
  hasAudio?: boolean // default true
  hasVideo?: boolean // default true
}) {
  const {
    server,
    playlistUrl,
    resolutions,
    token,
    hasAudio = true,
    hasVideo = true,
    splittedAudio = false,
    withRetry = false,
    transcoded = true
  } = options

  const masterPlaylist = await server.streamingPlaylists.get({ url: playlistUrl, token, withRetry })

  for (const resolution of resolutions) {
    // Audio is always splitted in HLS playlist if needed
    if (resolutions.length > 1 && resolution === VideoResolution.H_NOVIDEO) continue

    const resolutionStr = hasVideo
      ? `,RESOLUTION=\\d+x${resolution}`
      : ''

    let regexp = `#EXT-X-STREAM-INF:BANDWIDTH=\\d+${resolutionStr}`

    const videoCodec = hasVideo
      ? `avc1.6400[0-f]{2}`
      : ''

    const audioCodec = hasAudio
      ? 'mp4a.40.2'
      : ''

    const codecs = [ videoCodec, audioCodec ].filter(c => !!c).join(',')

    const audioGroup = splittedAudio && hasAudio && hasVideo
      ? ',AUDIO="(group_Audio|audio)"'
      : ''

    if (transcoded) {
      regexp += `,(FRAME-RATE=\\d+,)?CODECS="${codecs}"${audioGroup}`
    }

    expect(masterPlaylist).to.match(new RegExp(`${regexp}`))
  }

  if (splittedAudio && hasAudio && hasVideo) {
    expect(masterPlaylist).to.match(
      // eslint-disable-next-line max-len
      new RegExp(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="(group_Audio|audio)",NAME="(Audio|audio_0)"(,AUTOSELECT=YES)?,DEFAULT=YES,URI="[^.]*0.m3u8"`)
    )
  }

  const playlistsLength = masterPlaylist.split('\n').filter(line => line.startsWith('#EXT-X-STREAM-INF:BANDWIDTH='))
  const playlistsLengthShouldBe = resolutions.length === 1
    ? 1
    : resolutions.filter(r => r !== VideoResolution.H_NOVIDEO).length

  expect(playlistsLength).to.have.lengthOf(playlistsLengthShouldBe)
}

export async function completeCheckHlsPlaylist (options: {
  servers: PeerTubeServer[]
  videoUUID: string
  hlsOnly: boolean

  splittedAudio?: boolean // default false

  hasAudio?: boolean // default true
  hasVideo?: boolean // default true

  resolutions?: number[]
  objectStorageBaseUrl?: string
}) {
  const { videoUUID, hlsOnly, splittedAudio, hasAudio = true, hasVideo = true, objectStorageBaseUrl } = options

  const hlsResolutions = options.resolutions ?? [ 240, 360, 480, 720 ]
  const webVideoResolutions = [ ...hlsResolutions ]

  if (splittedAudio && hasAudio && !hlsResolutions.some(r => r === VideoResolution.H_NOVIDEO)) {
    hlsResolutions.push(VideoResolution.H_NOVIDEO)
  }

  for (const server of options.servers) {
    const videoDetails = await server.videos.getWithToken({ id: videoUUID })
    const requiresAuth = videoDetails.privacy.id === VideoPrivacy.PRIVATE || videoDetails.privacy.id === VideoPrivacy.INTERNAL

    const privatePath = requiresAuth
      ? 'private/'
      : ''
    const token = requiresAuth
      ? server.accessToken
      : undefined

    const baseUrl = `http://${videoDetails.account.host}`

    expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)

    const hlsPlaylist = videoDetails.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    expect(hlsPlaylist).to.not.be.undefined

    const hlsFiles = hlsPlaylist.files
    expect(hlsFiles).to.have.lengthOf(hlsResolutions.length)

    if (hlsOnly) expect(videoDetails.files).to.have.lengthOf(0)
    else expect(videoDetails.files).to.have.lengthOf(webVideoResolutions.length)

    // Check JSON files
    for (const resolution of hlsResolutions) {
      const file = hlsFiles.find(f => f.resolution.id === resolution)
      expect(file).to.not.be.undefined

      if (file.resolution.id === VideoResolution.H_NOVIDEO) {
        expect(file.resolution.label).to.equal('Audio')
        expect(file.hasAudio).to.be.true
        expect(file.hasVideo).to.be.false
      } else {
        expect(file.resolution.label).to.equal(resolution + 'p')

        expect(file.hasVideo).to.be.true
        expect(file.hasAudio).to.equal(hasAudio && !splittedAudio)
      }

      if (resolution === 0) {
        expect(file.height).to.equal(0)
        expect(file.width).to.equal(0)
      } else {
        expect(Math.min(file.height, file.width)).to.equal(resolution)
        expect(Math.max(file.height, file.width)).to.be.greaterThan(resolution)
      }

      expect(file.magnetUri).to.have.lengthOf.above(2)
      await checkWebTorrentWorks(file.magnetUri)

      {
        const nameReg = `${uuidRegex}-${file.resolution.id}`

        expect(file.torrentUrl).to.match(new RegExp(`${server.url}/lazy-static/torrents/${nameReg}-hls.torrent`))

        if (objectStorageBaseUrl && requiresAuth) {
          // eslint-disable-next-line max-len
          expect(file.fileUrl).to.match(new RegExp(`${server.url}/object-storage-proxy/streaming-playlists/hls/${privatePath}${videoDetails.uuid}/${nameReg}-fragmented.mp4`))
        } else if (objectStorageBaseUrl) {
          expectStartWith(file.fileUrl, objectStorageBaseUrl)
        } else {
          expect(file.fileUrl).to.match(
            new RegExp(`${baseUrl}/static/streaming-playlists/hls/${privatePath}${videoDetails.uuid}/${nameReg}-fragmented.mp4`)
          )
        }
      }

      {
        await Promise.all([
          makeRawRequest({ url: file.torrentUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
          makeRawRequest({ url: file.torrentDownloadUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
          makeRawRequest({ url: file.metadataUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
          makeRawRequest({ url: file.fileUrl, token, expectedStatus: HttpStatusCode.OK_200 }),

          makeRawRequest({
            url: file.fileDownloadUrl,
            token,
            expectedStatus: objectStorageBaseUrl
              ? HttpStatusCode.FOUND_302
              : HttpStatusCode.OK_200
          })
        ])
      }
    }

    // Check master playlist
    {
      await checkResolutionsInMasterPlaylist({
        server,
        token,
        playlistUrl: hlsPlaylist.playlistUrl,
        resolutions: hlsResolutions,
        hasAudio,
        hasVideo,
        splittedAudio
      })

      const masterPlaylist = await server.streamingPlaylists.get({ url: hlsPlaylist.playlistUrl, token })

      let i = 0
      for (const resolution of hlsResolutions) {
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)

        const url = 'http://' + videoDetails.account.host
        await hlsInfohashExist(url, hlsPlaylist.playlistUrl, i)

        i++
      }
    }

    // Check resolution playlists
    {
      for (const resolution of hlsResolutions) {
        const file = hlsFiles.find(f => f.resolution.id === resolution)
        const playlistName = removeFragmentedMP4Ext(basename(file.fileUrl)) + '.m3u8'

        let url: string
        if (objectStorageBaseUrl && requiresAuth) {
          url = `${baseUrl}/object-storage-proxy/streaming-playlists/hls/${privatePath}${videoUUID}/${playlistName}`
        } else if (objectStorageBaseUrl) {
          url = `${objectStorageBaseUrl}hls/${videoUUID}/${playlistName}`
        } else {
          url = `${baseUrl}/static/streaming-playlists/hls/${privatePath}${videoUUID}/${playlistName}`
        }

        const subPlaylist = await server.streamingPlaylists.get({ url, token })

        expect(subPlaylist).to.match(new RegExp(`${uuidRegex}-${resolution}-fragmented.mp4`))
        expect(subPlaylist).to.contain(basename(file.fileUrl))
      }
    }

    {
      let baseUrlAndPath: string
      if (objectStorageBaseUrl && requiresAuth) {
        baseUrlAndPath = `${baseUrl}/object-storage-proxy/streaming-playlists/hls/${privatePath}${videoUUID}`
      } else if (objectStorageBaseUrl) {
        baseUrlAndPath = `${objectStorageBaseUrl}hls/${videoUUID}`
      } else {
        baseUrlAndPath = `${baseUrl}/static/streaming-playlists/hls/${privatePath}${videoUUID}`
      }

      for (const resolution of hlsResolutions) {
        await checkSegmentHash({
          server,
          token,
          baseUrlPlaylist: baseUrlAndPath,
          baseUrlSegment: baseUrlAndPath,
          resolution,
          hlsPlaylist
        })
      }
    }
  }
}

export async function checkVideoFileTokenReinjection (options: {
  server: PeerTubeServer
  videoUUID: string
  videoFileToken: string
  resolutions: number[]
  isLive: boolean
}) {
  const { server, resolutions, videoFileToken, videoUUID, isLive } = options

  const video = await server.videos.getWithToken({ id: videoUUID })
  const hls = video.streamingPlaylists[0]

  const query = { videoFileToken, reinjectVideoFileToken: 'true' }
  const { text } = await makeRawRequest({ url: hls.playlistUrl, query, expectedStatus: HttpStatusCode.OK_200 })

  for (let i = 0; i < resolutions.length; i++) {
    const resolution = resolutions[i]

    const suffix = isLive
      ? i
      : `-${resolution}`

    expect(text).to.contain(`${suffix}.m3u8?videoFileToken=${videoFileToken}&reinjectVideoFileToken=true`)
  }

  const resolutionPlaylists = extractResolutionPlaylistUrls(hls.playlistUrl, text)
  expect(resolutionPlaylists).to.have.lengthOf(resolutions.length)

  for (const url of resolutionPlaylists) {
    const { text } = await makeRawRequest({ url, query, expectedStatus: HttpStatusCode.OK_200 })

    const extension = isLive
      ? '.ts'
      : '.mp4'

    expect(text).to.contain(`${extension}?videoFileToken=${videoFileToken}`)
    expect(text).not.to.contain(`reinjectVideoFileToken=true`)
  }
}

export function extractResolutionPlaylistUrls (masterPath: string, masterContent: string) {
  return masterContent.match(/[a-z0-9-]+\.m3u8(?:[?a-zA-Z0-9=&-]+)?/mg)
    .map(filename => join(dirname(masterPath), filename))
}
