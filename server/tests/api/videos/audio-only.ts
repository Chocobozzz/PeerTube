/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideo,
  root,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  waitJobs
} from '../../../../shared/extra-utils'
import { VideoDetails } from '../../../../shared/models/videos'
import { join } from 'path'
import { audio, getVideoStreamSize } from '@server/helpers/ffmpeg-utils'

const expect = chai.expect

describe('Test audio only video transcoding', function () {
  let servers: ServerInfo[] = []
  let videoUUID: string

  before(async function () {
    this.timeout(120000)

    const configOverride = {
      transcoding: {
        enabled: true,
        resolutions: {
          '0p': true,
          '240p': true,
          '360p': false,
          '480p': false,
          '720p': false,
          '1080p': false,
          '2160p': false
        },
        hls: {
          enabled: true
        },
        webtorrent: {
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

  it('Should upload a video and transcode it', async function () {
    this.timeout(120000)

    const resUpload = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'audio only' })
    videoUUID = resUpload.body.video.uuid

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video: VideoDetails = res.body

      expect(video.streamingPlaylists).to.have.lengthOf(1)

      for (const files of [ video.files, video.streamingPlaylists[0].files ]) {
        expect(files).to.have.lengthOf(3)
        expect(files[0].resolution.id).to.equal(720)
        expect(files[1].resolution.id).to.equal(240)
        expect(files[2].resolution.id).to.equal(0)
      }
    }
  })

  it('0p transcoded video should not have video', async function () {
    const paths = [
      join(root(), 'test' + servers[0].internalServerNumber, 'videos', videoUUID + '-0.mp4'),
      join(root(), 'test' + servers[0].internalServerNumber, 'streaming-playlists', 'hls', videoUUID, videoUUID + '-0-fragmented.mp4')
    ]

    for (const path of paths) {
      const { audioStream } = await audio.get(path)
      expect(audioStream['codec_name']).to.be.equal('aac')
      expect(audioStream['bit_rate']).to.be.at.most(384 * 8000)

      const size = await getVideoStreamSize(path)
      expect(size.height).to.equal(0)
      expect(size.width).to.equal(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
