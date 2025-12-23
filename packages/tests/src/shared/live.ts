/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getVideoStreamDimensionsInfo, getVideoStreamFPS } from '@peertube/peertube-ffmpeg'
import { LiveVideo, VideoResolution, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { ObjectStorageCommand, PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { SQLCommand } from './sql-command.js'
import { checkLiveSegmentHash, checkPlaylistInfohash, checkResolutionsInMasterPlaylist } from './streaming-playlists.js'

async function checkLiveCleanup (options: {
  server: PeerTubeServer
  videoUUID: string
  permanent: boolean
  savedResolutions?: number[]
  deleted?: boolean // default false
}) {
  const { server, videoUUID, permanent, savedResolutions = [], deleted = false } = options

  const basePath = server.servers.buildDirectory('streaming-playlists')
  const hlsPath = join(basePath, 'hls', videoUUID)
  const hlsPathExists = await pathExists(hlsPath)

  if (deleted) {
    expect(hlsPathExists).to.be.false
    return
  }

  if (permanent) {
    if (!hlsPathExists) return

    const files = await readdir(hlsPath)
    expect(files.filter(f => f !== 'replay')).to.have.lengthOf(0)

    const replayDir = join(hlsPath, 'replay')
    if (await pathExists(replayDir)) {
      expect(await readdir(replayDir)).to.have.lengthOf(0)
    }
  } else {
    if (savedResolutions.length === 0) {
      return checkUnsavedLiveCleanup(server, videoUUID, hlsPath)
    }

    return checkSavedLiveCleanup(hlsPath, savedResolutions)
  }
}

// ---------------------------------------------------------------------------

async function testLiveVideoResolutions (options: {
  sqlCommand: SQLCommand
  originServer: PeerTubeServer

  servers: PeerTubeServer[]
  liveVideoId: string

  resolutions: number[]
  framerates?: { [id: number]: number }

  transcoded: boolean

  hasAudio?: boolean
  hasVideo?: boolean

  objectStorage?: ObjectStorageCommand
  objectStorageBaseUrl?: string
}) {
  const {
    originServer,
    sqlCommand,
    servers,
    liveVideoId,
    transcoded,
    framerates,
    objectStorage,
    hasAudio = true,
    hasVideo = true,
    objectStorageBaseUrl = objectStorage?.getMockPlaylistBaseUrl()
  } = options

  // Live is always audio/video splitted
  const splittedAudio = transcoded

  const resolutions = splittedAudio && options.resolutions.length > 1 && !options.resolutions.includes(VideoResolution.H_NOVIDEO)
    ? [ VideoResolution.H_NOVIDEO, ...options.resolutions ]
    : [ ...options.resolutions ]

  const isAudioOnly = resolutions.every(r => r === VideoResolution.H_NOVIDEO)

  for (const server of servers) {
    const { data } = await server.videos.list()
    expect(data.find(v => v.uuid === liveVideoId)).to.exist

    const video = await server.videos.get({ id: liveVideoId })

    if (isAudioOnly) {
      expect(video.aspectRatio).to.equal(0)
    } else {
      expect(video.aspectRatio).to.equal(1.7778)
    }

    expect(video.streamingPlaylists).to.have.lengthOf(1)

    const hlsPlaylist = video.streamingPlaylists.find(s => s.type === VideoStreamingPlaylistType.HLS)
    expect(hlsPlaylist).to.exist
    expect(hlsPlaylist.files).to.have.lengthOf(0) // Only fragmented mp4 files are displayed

    await checkResolutionsInMasterPlaylist({
      server,
      playlistUrl: hlsPlaylist.playlistUrl,
      resolutions,
      framerates,
      transcoded,
      splittedAudio,
      hasAudio,
      hasVideo,
      withRetry: !!objectStorage
    })

    if (objectStorage) {
      expect(hlsPlaylist.playlistUrl).to.contain(objectStorageBaseUrl)
    }

    for (let i = 0; i < resolutions.length; i++) {
      const segmentNum = 3
      const segmentName = `${i}-00000${segmentNum}.ts`
      await originServer.live.waitUntilSegmentGeneration({
        server: originServer,
        videoUUID: video.uuid,
        playlistNumber: i,
        segment: segmentNum,
        objectStorage,
        objectStorageBaseUrl
      })

      if (framerates) {
        const segmentPath = servers[0].servers.buildDirectory(join('streaming-playlists', 'hls', video.uuid, segmentName))
        const { resolution } = await getVideoStreamDimensionsInfo(segmentPath)

        if (resolution) {
          const fps = await getVideoStreamFPS(segmentPath)
          expect(fps).to.equal(framerates[resolution])
        }
      }

      const baseUrl = objectStorage
        ? join(objectStorageBaseUrl, 'hls')
        : originServer.url + '/static/streaming-playlists/hls'

      if (objectStorage) {
        expect(hlsPlaylist.segmentsSha256Url).to.contain(objectStorageBaseUrl)
      }

      const subPlaylist = await originServer.streamingPlaylists.get({
        url: `${baseUrl}/${video.uuid}/${i}.m3u8`,
        withRetry: !!objectStorage // With object storage, the request may fail because of inconsistent data in S3
      })

      expect(subPlaylist).to.contain(segmentName)

      await checkLiveSegmentHash({
        server,
        baseUrlSegment: baseUrl,
        videoUUID: video.uuid,
        segmentName,
        hlsPlaylist,
        withRetry: !!objectStorage // With object storage, the request may fail because of inconsistent data in S3
      })
    }

    if (originServer.internalServerNumber === server.internalServerNumber) {
      await checkPlaylistInfohash({ video, sqlCommand, files: resolutions.map(r => ({ resolution: { id: r } })) })
    }
  }
}

// ---------------------------------------------------------------------------

export {
  checkLiveCleanup,
  testLiveVideoResolutions
}

// ---------------------------------------------------------------------------

async function checkSavedLiveCleanup (hlsPath: string, savedResolutions: number[] = []) {
  const files = await readdir(hlsPath)

  // fragmented file and playlist per resolution + master playlist + segments sha256 json file
  expect(files, `Directory content: ${files.join(', ')}`).to.have.lengthOf(savedResolutions.length * 2 + 2)

  for (const resolution of savedResolutions) {
    const fragmentedFile = files.find(f => f.endsWith(`-${resolution}-fragmented.mp4`))
    expect(fragmentedFile).to.exist

    const playlistFile = files.find(f => f.endsWith(`${resolution}.m3u8`))
    expect(playlistFile).to.exist
  }

  const masterPlaylistFile = files.find(f => f.endsWith('-master.m3u8'))
  expect(masterPlaylistFile).to.exist

  const shaFile = files.find(f => f.endsWith('-segments-sha256.json'))
  expect(shaFile).to.exist
}

async function checkUnsavedLiveCleanup (server: PeerTubeServer, videoUUID: string, hlsPath: string) {
  let live: LiveVideo

  try {
    live = await server.live.get({ videoId: videoUUID })
  } catch {}

  if (live?.permanentLive) {
    expect(await pathExists(hlsPath)).to.be.true

    const hlsFiles = await readdir(hlsPath)
    expect(hlsFiles).to.have.lengthOf(1) // Only replays directory

    const replayDir = join(hlsPath, 'replay')
    expect(await pathExists(replayDir)).to.be.true

    const replayFiles = await readdir(join(hlsPath, 'replay'))
    expect(replayFiles).to.have.lengthOf(0)

    return
  }

  expect(await pathExists(hlsPath)).to.be.false
}
