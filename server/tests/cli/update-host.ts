/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { VideoDetails } from '../../../shared/models/videos'
import {
  execCLI,
  flushTests,
  getEnvCli,
  getVideo,
  getVideosList,
  killallServers,
  parseTorrentVideo,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../utils'
import { waitJobs } from '../utils/server/jobs'

const expect = chai.expect

describe('Test update host scripts', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(60000)

    await flushTests()

    const overrideConfig = {
      webserver: {
        port: 9256
      }
    }
    // Run server 2 to have transcoding enabled
    server = await runServer(2, overrideConfig)
    await setAccessTokensToServers([ server ])

    // Upload two videos for our needs
    const videoAttributes = {}
    await uploadVideo(server.url, server.accessToken, videoAttributes)
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    await waitJobs(server)
  })

  it('Should update torrent hosts', async function () {
    this.timeout(30000)

    killallServers([ server ])
    // Run server with standard configuration
    server = await runServer(2)

    const env = getEnvCli(server)
    await execCLI(`${env} npm run update-host`)

    const res = await getVideosList(server.url)
    const videos = res.body.data
    expect(videos).to.have.lengthOf(2)

    for (const video of videos) {
      const res2 = await getVideo(server.url, video.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)

      for (const file of videoDetails.files) {
        expect(file.magnetUri).to.contain('localhost%3A9002%2Ftracker%2Fsocket')
        expect(file.magnetUri).to.contain('localhost%3A9002%2Fstatic%2Fwebseed%2F')

        const torrent = await parseTorrentVideo(server, videoDetails.uuid, file.resolution.id)
        const announceWS = torrent.announce.find(a => a === 'ws://localhost:9002/tracker/socket')
        expect(announceWS).to.not.be.undefined

        const announceHttp = torrent.announce.find(a => a === 'http://localhost:9002/tracker/announce')
        expect(announceHttp).to.not.be.undefined

        expect(torrent.urlList[0]).to.contain('http://localhost:9002/static/webseed')
      }
    }
  })

  after(async function () {
    killallServers([ server ])
  })
})
