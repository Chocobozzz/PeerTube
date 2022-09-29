/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { basename, join } from 'path'
import {
  checkDirectoryIsEmpty,
  checkResolutionsInMasterPlaylist,
  checkSegmentHash,
  checkTmpIsEmpty,
  expectStartWith,
  hlsInfohashExist
} from '@server/tests/shared'
import { areObjectStorageTestsDisabled, removeFragmentedMP4Ext, uuidRegex } from '@shared/core-utils'
import { HttpStatusCode, VideoStreamingPlaylistType } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs,
  webtorrentAdd
} from '@shared/server-commands'
import { DEFAULT_AUDIO_RESOLUTION } from '../../../initializers/constants'

async function checkHlsPlaylist (options: {
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
        new RegExp(`http://${server.host}/lazy-static/torrents/${uuidRegex}-${file.resolution.id}-hls.torrent`)
      )

      if (objectStorageBaseUrl) {
        expectStartWith(file.fileUrl, objectStorageBaseUrl)
      } else {
        expect(file.fileUrl).to.match(
          new RegExp(`${baseUrl}/static/streaming-playlists/hls/${videoDetails.uuid}/${uuidRegex}-${file.resolution.id}-fragmented.mp4`)
        )
      }

      expect(file.resolution.label).to.equal(resolution + 'p')

      await makeRawRequest(file.torrentUrl, HttpStatusCode.OK_200)
      await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)

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

describe('Test HLS videos', function () {
  let servers: PeerTubeServer[] = []
  let videoUUID = ''
  let videoAudioUUID = ''

  function runTestSuite (hlsOnly: boolean, objectStorageBaseUrl?: string) {

    it('Should upload a video and transcode it to HLS', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video 1', fixture: 'video_short.webm' } })
      videoUUID = uuid

      await waitJobs(servers)

      await checkHlsPlaylist({ servers, videoUUID, hlsOnly, objectStorageBaseUrl })
    })

    it('Should upload an audio file and transcode it to HLS', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video audio', fixture: 'sample.ogg' } })
      videoAudioUUID = uuid

      await waitJobs(servers)

      await checkHlsPlaylist({
        servers,
        videoUUID: videoAudioUUID,
        hlsOnly,
        resolutions: [ DEFAULT_AUDIO_RESOLUTION, 360, 240 ],
        objectStorageBaseUrl
      })
    })

    it('Should update the video', async function () {
      this.timeout(30000)

      await servers[0].videos.update({ id: videoUUID, attributes: { name: 'video 1 updated' } })

      await waitJobs(servers)

      await checkHlsPlaylist({ servers, videoUUID, hlsOnly, objectStorageBaseUrl })
    })

    it('Should delete videos', async function () {
      this.timeout(10000)

      await servers[0].videos.remove({ id: videoUUID })
      await servers[0].videos.remove({ id: videoAudioUUID })

      await waitJobs(servers)

      for (const server of servers) {
        await server.videos.get({ id: videoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await server.videos.get({ id: videoAudioUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }
    })

    it('Should have the playlists/segment deleted from the disk', async function () {
      for (const server of servers) {
        await checkDirectoryIsEmpty(server, 'videos')
        await checkDirectoryIsEmpty(server, join('streaming-playlists', 'hls'))
      }
    })

    it('Should have an empty tmp directory', async function () {
      for (const server of servers) {
        await checkTmpIsEmpty(server)
      }
    })
  }

  before(async function () {
    this.timeout(120000)

    const configOverride = {
      transcoding: {
        enabled: true,
        allow_audio_files: true,
        hls: {
          enabled: true
        }
      }
    }
    servers = await createMultipleServers(2, configOverride)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('With WebTorrent & HLS enabled', function () {
    runTestSuite(false)
  })

  describe('With only HLS enabled', function () {

    before(async function () {
      await servers[0].config.updateCustomSubConfig({
        newConfig: {
          transcoding: {
            enabled: true,
            allowAudioFiles: true,
            resolutions: {
              '144p': false,
              '240p': true,
              '360p': true,
              '480p': true,
              '720p': true,
              '1080p': true,
              '1440p': true,
              '2160p': true
            },
            hls: {
              enabled: true
            },
            webtorrent: {
              enabled: false
            }
          }
        }
      })
    })

    runTestSuite(true)
  })

  describe('With object storage enabled', function () {
    if (areObjectStorageTestsDisabled()) return

    before(async function () {
      this.timeout(120000)

      const configOverride = ObjectStorageCommand.getDefaultConfig()
      await ObjectStorageCommand.prepareDefaultBuckets()

      await servers[0].kill()
      await servers[0].run(configOverride)
    })

    runTestSuite(true, ObjectStorageCommand.getPlaylistBaseUrl())
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
