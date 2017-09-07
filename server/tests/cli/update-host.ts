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
  uploadVideo
} from '../utils'

describe('Test update host scripts', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    await flushTests()

    const overrideConfig = {
      webserver: {
        port: 9256
      }
    }
    server = await runServer(1, overrideConfig)
    await setAccessTokensToServers([ server ])

    // Upload two videos for our needs
    const videoAttributes = {}
    await uploadVideo(server.url, server.accessToken, videoAttributes)
    await uploadVideo(server.url, server.accessToken, videoAttributes)
  })

  it('Should update torrent hosts', async function () {
    this.timeout(20000)

    killallServers([ server ])
    server = await runServer(1)

    const env = getEnvCli(server)
    await execCLI(`${env} npm run update-host`)

    const res = await getVideosList(server.url)
    const videos = res.body.data

    expect(videos[0].files[0].magnetUri).to.contain('localhost%3A9001%2Ftracker%2Fsocket')
    expect(videos[0].files[0].magnetUri).to.contain('localhost%3A9001%2Fstatic%2Fwebseed%2F')

    expect(videos[1].files[0].magnetUri).to.contain('localhost%3A9001%2Ftracker%2Fsocket')
    expect(videos[1].files[0].magnetUri).to.contain('localhost%3A9001%2Fstatic%2Fwebseed%2F')

    const torrent = await parseTorrentVideo(server, videos[0].uuid)
    expect(torrent.announce[0]).to.equal('ws://localhost:9001/tracker/socket')
    expect(torrent.urlList[0]).to.contain('http://localhost:9001/static/webseed')
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
