/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { VideoDetails } from '../../../shared/models/videos'
import { waitJobs } from '../../../shared/extra-utils/server/jobs'
import { addVideoCommentThread } from '../../../shared/extra-utils/videos/video-comments'
import {
  addVideoChannel,
  cleanupTests,
  createUser,
  execCLI,
  flushAndRunServer,
  getEnvCli,
  getVideo,
  getVideoChannelsList,
  getVideosList,
  killallServers,
  makeActivityPubGetRequest,
  parseTorrentVideo, reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../../shared/extra-utils'
import { getAccountsList } from '../../../shared/extra-utils/users/accounts'

const expect = chai.expect

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
    const videoAttributes = {}
    const resVideo1 = await uploadVideo(server.url, server.accessToken, videoAttributes)
    const video1UUID = resVideo1.body.video.uuid
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    // Create a user
    await createUser({ url: server.url, accessToken: server.accessToken, username: 'toto', password: 'coucou' })

    // Create channel
    const videoChannel = {
      name: 'second_channel',
      displayName: 'second video channel',
      description: 'super video channel description'
    }
    await addVideoChannel(server.url, server.accessToken, videoChannel)

    // Create comments
    const text = 'my super first comment'
    await addVideoCommentThread(server.url, server.accessToken, video1UUID, text)

    await waitJobs(server)
  })

  it('Should run update host', async function () {
    this.timeout(30000)

    killallServers([ server ])
    // Run server with standard configuration
    await reRunServer(server)

    const env = getEnvCli(server)
    await execCLI(`${env} npm run update-host`)
  })

  it('Should have updated videos url', async function () {
    const res = await getVideosList(server.url)
    expect(res.body.total).to.equal(2)

    for (const video of res.body.data) {
      const { body } = await makeActivityPubGetRequest(server.url, '/videos/watch/' + video.uuid)

      expect(body.id).to.equal('http://localhost:9002/videos/watch/' + video.uuid)

      const res = await getVideo(server.url, video.uuid)
      const videoDetails: VideoDetails = res.body

      expect(videoDetails.trackerUrls[0]).to.include(server.host)
      expect(videoDetails.streamingPlaylists[0].playlistUrl).to.include(server.host)
      expect(videoDetails.streamingPlaylists[0].segmentsSha256Url).to.include(server.host)
    }
  })

  it('Should have updated video channels url', async function () {
    const res = await getVideoChannelsList(server.url, 0, 5, '-name')
    expect(res.body.total).to.equal(3)

    for (const channel of res.body.data) {
      const { body } = await makeActivityPubGetRequest(server.url, '/video-channels/' + channel.name)

      expect(body.id).to.equal('http://localhost:9002/video-channels/' + channel.name)
    }
  })

  it('Should have updated accounts url', async function () {
    const res = await getAccountsList(server.url)
    expect(res.body.total).to.equal(3)

    for (const account of res.body.data) {
      const usernameWithDomain = account.name
      const { body } = await makeActivityPubGetRequest(server.url, '/accounts/' + usernameWithDomain)

      expect(body.id).to.equal('http://localhost:9002/accounts/' + usernameWithDomain)
    }
  })

  it('Should have updated torrent hosts', async function () {
    this.timeout(30000)

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
    await cleanupTests([ server ])
  })
})
