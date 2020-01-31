/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  checkDirectoryIsEmpty,
  checkSegmentHash,
  checkTmpIsEmpty,
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  getPlaylist,
  getVideo,
  makeRawRequest,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  updateVideo,
  uploadVideo,
  waitJobs,
  webtorrentAdd
} from '../../../../shared/extra-utils'
import { VideoDetails } from '../../../../shared/models/videos'
import { VideoStreamingPlaylistType } from '../../../../shared/models/videos/video-streaming-playlist.type'
import { join } from 'path'
import { DEFAULT_AUDIO_RESOLUTION } from '../../../initializers/constants'

const expect = chai.expect

async function checkHlsPlaylist (servers: ServerInfo[], videoUUID: string, hlsOnly: boolean, resolutions = [ 240, 360, 480, 720 ]) {
  for (const server of servers) {
    const resVideoDetails = await getVideo(server.url, videoUUID)
    const videoDetails: VideoDetails = resVideoDetails.body
    const baseUrl = `http://${videoDetails.account.host}`

    expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)

    const hlsPlaylist = videoDetails.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    expect(hlsPlaylist).to.not.be.undefined

    const hlsFiles = hlsPlaylist.files
    expect(hlsFiles).to.have.lengthOf(resolutions.length)

    if (hlsOnly) expect(videoDetails.files).to.have.lengthOf(0)
    else expect(videoDetails.files).to.have.lengthOf(resolutions.length)

    for (const resolution of resolutions) {
      const file = hlsFiles.find(f => f.resolution.id === resolution)
      expect(file).to.not.be.undefined

      expect(file.magnetUri).to.have.lengthOf.above(2)
      expect(file.torrentUrl).to.equal(`${baseUrl}/static/torrents/${videoDetails.uuid}-${file.resolution.id}-hls.torrent`)
      expect(file.fileUrl).to.equal(
        `${baseUrl}/static/streaming-playlists/hls/${videoDetails.uuid}/${videoDetails.uuid}-${file.resolution.id}-fragmented.mp4`
      )
      expect(file.resolution.label).to.equal(resolution + 'p')

      await makeRawRequest(file.torrentUrl, 200)
      await makeRawRequest(file.fileUrl, 200)

      const torrent = await webtorrentAdd(file.magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    }

    {
      const res = await getPlaylist(hlsPlaylist.playlistUrl)

      const masterPlaylist = res.text

      for (const resolution of resolutions) {
        const reg = new RegExp(
          '#EXT-X-STREAM-INF:BANDWIDTH=\\d+,RESOLUTION=\\d+x' + resolution + ',FRAME-RATE=\\d+,CODECS="avc1.64001f,mp4a.40.2"'
        )

        expect(masterPlaylist).to.match(reg)
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)
      }
    }

    {
      for (const resolution of resolutions) {
        const res = await getPlaylist(`${baseUrl}/static/streaming-playlists/hls/${videoUUID}/${resolution}.m3u8`)

        const subPlaylist = res.text
        expect(subPlaylist).to.contain(`${videoUUID}-${resolution}-fragmented.mp4`)
      }
    }

    {
      const baseUrlAndPath = baseUrl + '/static/streaming-playlists/hls'

      for (const resolution of resolutions) {
        await checkSegmentHash(baseUrlAndPath, baseUrlAndPath, videoUUID, resolution, hlsPlaylist)
      }
    }
  }
}

describe('Test HLS videos', function () {
  let servers: ServerInfo[] = []
  let videoUUID = ''
  let videoAudioUUID = ''

  function runTestSuite (hlsOnly: boolean) {
    it('Should upload a video and transcode it to HLS', async function () {
      this.timeout(120000)

      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video 1', fixture: 'video_short.webm' })
      videoUUID = res.body.video.uuid

      await waitJobs(servers)

      await checkHlsPlaylist(servers, videoUUID, hlsOnly)
    })

    it('Should upload an audio file and transcode it to HLS', async function () {
      this.timeout(120000)

      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video audio', fixture: 'sample.ogg' })
      videoAudioUUID = res.body.video.uuid

      await waitJobs(servers)

      await checkHlsPlaylist(servers, videoAudioUUID, hlsOnly, [ DEFAULT_AUDIO_RESOLUTION ])
    })

    it('Should update the video', async function () {
      this.timeout(10000)

      await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { name: 'video 1 updated' })

      await waitJobs(servers)

      await checkHlsPlaylist(servers, videoUUID, hlsOnly)
    })

    it('Should delete videos', async function () {
      this.timeout(10000)

      await removeVideo(servers[0].url, servers[0].accessToken, videoUUID)
      await removeVideo(servers[0].url, servers[0].accessToken, videoAudioUUID)

      await waitJobs(servers)

      for (const server of servers) {
        await getVideo(server.url, videoUUID, 404)
        await getVideo(server.url, videoAudioUUID, 404)
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
    servers = await flushAndRunMultipleServers(2, configOverride)

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
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
        transcoding: {
          enabled: true,
          allowAudioFiles: true,
          resolutions: {
            '240p': true,
            '360p': true,
            '480p': true,
            '720p': true,
            '1080p': true,
            '2160p': true
          },
          hls: {
            enabled: true
          },
          webtorrent: {
            enabled: false
          }
        }
      })
    })

    runTestSuite(true)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
