import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  execCLI,
  flushTests,
  getEnvCli,
  getVideosList,
  killallServers,
  parseTorrentVideo,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait,
  getVideo
} from '../utils'

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
    await wait(30000)
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
      const videoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)

      for (const file of videoDetails.files) {
        expect(file.magnetUri).to.contain('localhost%3A9002%2Ftracker%2Fsocket')
        expect(file.magnetUri).to.contain('localhost%3A9002%2Fstatic%2Fwebseed%2F')

        const torrent = await parseTorrentVideo(server, videoDetails.uuid, file.resolution)
        expect(torrent.announce[0]).to.equal('ws://localhost:9002/tracker/socket')
        expect(torrent.urlList[0]).to.contain('http://localhost:9002/static/webseed')
      }
    }
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
