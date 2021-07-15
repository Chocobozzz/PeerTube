/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import {
  cleanupTests,
  flushAndRunServer,
  killallServers,
  makeActivityPubGetRequest,
  parseTorrentVideo,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  waitJobs
} from '@shared/extra-utils'

describe('Test update host scripts', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(60000)

    const overrideConfig = {
      webserver: {
        port: 9256
      }
    }
    // Run server 2 to have transcoding enabled
    server = await flushAndRunServer(2, overrideConfig)
    await setAccessTokensToServers([ server ])

    // Upload two videos for our needs
    const { uuid: video1UUID } = await server.videosCommand.upload()
    await server.videosCommand.upload()

    // Create a user
    await server.usersCommand.create({ username: 'toto', password: 'coucou' })

    // Create channel
    const videoChannel = {
      name: 'second_channel',
      displayName: 'second video channel',
      description: 'super video channel description'
    }
    await server.channelsCommand.create({ attributes: videoChannel })

    // Create comments
    const text = 'my super first comment'
    await server.commentsCommand.createThread({ videoId: video1UUID, text })

    await waitJobs(server)
  })

  it('Should run update host', async function () {
    this.timeout(30000)

    await killallServers([ server ])
    // Run server with standard configuration
    await reRunServer(server)

    await server.cliCommand.execWithEnv(`npm run update-host`)
  })

  it('Should have updated videos url', async function () {
    const { total, data } = await server.videosCommand.list()
    expect(total).to.equal(2)

    for (const video of data) {
      const { body } = await makeActivityPubGetRequest(server.url, '/videos/watch/' + video.uuid)

      expect(body.id).to.equal('http://localhost:9002/videos/watch/' + video.uuid)

      const videoDetails = await server.videosCommand.get({ id: video.uuid })

      expect(videoDetails.trackerUrls[0]).to.include(server.host)
      expect(videoDetails.streamingPlaylists[0].playlistUrl).to.include(server.host)
      expect(videoDetails.streamingPlaylists[0].segmentsSha256Url).to.include(server.host)
    }
  })

  it('Should have updated video channels url', async function () {
    const { data, total } = await server.channelsCommand.list({ sort: '-name' })
    expect(total).to.equal(3)

    for (const channel of data) {
      const { body } = await makeActivityPubGetRequest(server.url, '/video-channels/' + channel.name)

      expect(body.id).to.equal('http://localhost:9002/video-channels/' + channel.name)
    }
  })

  it('Should have updated accounts url', async function () {
    const body = await server.accountsCommand.list()
    expect(body.total).to.equal(3)

    for (const account of body.data) {
      const usernameWithDomain = account.name
      const { body } = await makeActivityPubGetRequest(server.url, '/accounts/' + usernameWithDomain)

      expect(body.id).to.equal('http://localhost:9002/accounts/' + usernameWithDomain)
    }
  })

  it('Should have updated torrent hosts', async function () {
    this.timeout(30000)

    const { data } = await server.videosCommand.list()
    expect(data).to.have.lengthOf(2)

    for (const video of data) {
      const videoDetails = await server.videosCommand.get({ id: video.id })

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
    await cleanupTests([ server ])
  })
})
