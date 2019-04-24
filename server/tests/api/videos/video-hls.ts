/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  checkDirectoryIsEmpty,
  checkSegmentHash,
  checkTmpIsEmpty, cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  getPlaylist,
  getVideo,
  killallServers,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  waitJobs
} from '../../../../shared/extra-utils'
import { VideoDetails } from '../../../../shared/models/videos'
import { VideoStreamingPlaylistType } from '../../../../shared/models/videos/video-streaming-playlist.type'
import { join } from 'path'

const expect = chai.expect

async function checkHlsPlaylist (servers: ServerInfo[], videoUUID: string) {
  const resolutions = [ 240, 360, 480, 720 ]

  for (const server of servers) {
    const res = await getVideo(server.url, videoUUID)
    const videoDetails: VideoDetails = res.body

    expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)

    const hlsPlaylist = videoDetails.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    expect(hlsPlaylist).to.not.be.undefined

    {
      const res2 = await getPlaylist(hlsPlaylist.playlistUrl)

      const masterPlaylist = res2.text

      expect(masterPlaylist).to.contain('#EXT-X-STREAM-INF:BANDWIDTH=55472,RESOLUTION=640x360,FRAME-RATE=25')

      for (const resolution of resolutions) {
        expect(masterPlaylist).to.contain(`${resolution}.m3u8`)
      }
    }

    {
      for (const resolution of resolutions) {
        const res2 = await getPlaylist(`http://localhost:9001/static/streaming-playlists/hls/${videoUUID}/${resolution}.m3u8`)

        const subPlaylist = res2.text
        expect(subPlaylist).to.contain(`${videoUUID}-${resolution}-fragmented.mp4`)
      }
    }

    {
      const baseUrl = 'http://localhost:9001/static/streaming-playlists/hls'

      for (const resolution of resolutions) {
        await checkSegmentHash(baseUrl, baseUrl, videoUUID, resolution, hlsPlaylist)
      }
    }
  }
}

describe('Test HLS videos', function () {
  let servers: ServerInfo[] = []
  let videoUUID = ''

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2, { transcoding: { enabled: true, hls: { enabled: true } } })

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload a video and transcode it to HLS', async function () {
    this.timeout(120000)

    {
      const res = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, { name: 'video 1', fixture: 'video_short.webm' })
      videoUUID = res.body.video.uuid
    }

    await waitJobs(servers)

    await checkHlsPlaylist(servers, videoUUID)
  })

  it('Should update the video', async function () {
    await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { name: 'video 1 updated' })

    await waitJobs(servers)

    await checkHlsPlaylist(servers, videoUUID)
  })

  it('Should delete the video', async function () {
    await removeVideo(servers[0].url, servers[0].accessToken, videoUUID)

    await waitJobs(servers)

    for (const server of servers) {
      await getVideo(server.url, videoUUID, 404)
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

  after(async function () {
    await cleanupTests(servers)
  })
})
