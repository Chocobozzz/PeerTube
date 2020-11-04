/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { LiveVideo, LiveVideoCreate, User, VideoDetails, VideoPrivacy } from '@shared/models'
import {
  addVideoToBlacklist,
  cleanupTests,
  createLive,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getLive,
  getMyUserInformation,
  getVideo,
  getVideosList,
  makeRawRequest,
  removeVideo,
  sendRTMPStream,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testFfmpegStreamError,
  testImage,
  updateCustomSubConfig,
  updateLive,
  userLogin,
  waitJobs
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test live', function () {
  let servers: ServerInfo[] = []
  let userId: number
  let userAccessToken: string
  let userChannelId: number

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      live: {
        enabled: true,
        allowReplay: true,
        transcoding: {
          enabled: false
        }
      }
    })

    {
      const user = { username: 'user1', password: 'superpassword' }
      const res = await createUser({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        username: user.username,
        password: user.password
      })
      userId = res.body.user.id

      userAccessToken = await userLogin(servers[0], user)

      const resMe = await getMyUserInformation(servers[0].url, userAccessToken)
      userChannelId = (resMe.body as User).videoChannels[0].id
    }

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Live creation, update and delete', function () {
    let liveVideoUUID: string

    it('Should create a live with the appropriate parameters', async function () {
      this.timeout(20000)

      const attributes: LiveVideoCreate = {
        category: 1,
        licence: 2,
        language: 'fr',
        description: 'super live description',
        support: 'support field',
        channelId: servers[0].videoChannel.id,
        nsfw: false,
        waitTranscoding: false,
        name: 'my super live',
        tags: [ 'tag1', 'tag2' ],
        commentsEnabled: false,
        downloadEnabled: false,
        saveReplay: true,
        privacy: VideoPrivacy.PUBLIC,
        previewfile: 'video_short1-preview.webm.jpg',
        thumbnailfile: 'video_short1.webm.jpg'
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, attributes)
      liveVideoUUID = res.body.video.uuid

      await waitJobs(servers)

      for (const server of servers) {
        const resVideo = await getVideo(server.url, liveVideoUUID)
        const video: VideoDetails = resVideo.body

        expect(video.category.id).to.equal(1)
        expect(video.licence.id).to.equal(2)
        expect(video.language.id).to.equal('fr')
        expect(video.description).to.equal('super live description')
        expect(video.support).to.equal('support field')

        expect(video.channel.name).to.equal(servers[0].videoChannel.name)
        expect(video.channel.host).to.equal(servers[0].videoChannel.host)

        expect(video.nsfw).to.be.false
        expect(video.waitTranscoding).to.be.false
        expect(video.name).to.equal('my super live')
        expect(video.tags).to.deep.equal([ 'tag1', 'tag2' ])
        expect(video.commentsEnabled).to.be.false
        expect(video.downloadEnabled).to.be.false
        expect(video.privacy.id).to.equal(VideoPrivacy.PUBLIC)

        await testImage(server.url, 'video_short1-preview.webm', video.previewPath)
        await testImage(server.url, 'video_short1.webm', video.thumbnailPath)

        const resLive = await getLive(server.url, server.accessToken, liveVideoUUID)
        const live: LiveVideo = resLive.body

        if (server.url === servers[0].url) {
          expect(live.rtmpUrl).to.equal('rtmp://' + server.hostname + ':1936/live')
          expect(live.streamKey).to.not.be.empty
        } else {
          expect(live.rtmpUrl).to.be.null
          expect(live.streamKey).to.be.null
        }

        expect(live.saveReplay).to.be.true
      }
    })

    it('Should have a default preview and thumbnail', async function () {
      this.timeout(20000)

      const attributes: LiveVideoCreate = {
        name: 'default live thumbnail',
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.UNLISTED,
        nsfw: true
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, attributes)
      const videoId = res.body.video.uuid

      await waitJobs(servers)

      for (const server of servers) {
        const resVideo = await getVideo(server.url, videoId)
        const video: VideoDetails = resVideo.body

        expect(video.privacy.id).to.equal(VideoPrivacy.UNLISTED)
        expect(video.nsfw).to.be.true

        await makeRawRequest(server.url + video.thumbnailPath, 200)
        await makeRawRequest(server.url + video.previewPath, 200)
      }
    })

    it('Should not have the live listed since nobody streams into', async function () {
      for (const server of servers) {
        const res = await getVideosList(server.url)

        expect(res.body.total).to.equal(0)
        expect(res.body.data).to.have.lengthOf(0)
      }
    })

    it('Should not be able to update a live of another server', async function () {
      await updateLive(servers[1].url, servers[1].accessToken, liveVideoUUID, { saveReplay: false }, 403)
    })

    it('Should update the live', async function () {
      this.timeout(10000)

      await updateLive(servers[0].url, servers[0].accessToken, liveVideoUUID, { saveReplay: false })
      await waitJobs(servers)
    })

    it('Have the live updated', async function () {
      for (const server of servers) {
        const res = await getLive(server.url, server.accessToken, liveVideoUUID)
        const live: LiveVideo = res.body

        if (server.url === servers[0].url) {
          expect(live.rtmpUrl).to.equal('rtmp://' + server.hostname + ':1936/live')
          expect(live.streamKey).to.not.be.empty
        } else {
          expect(live.rtmpUrl).to.be.null
          expect(live.streamKey).to.be.null
        }

        expect(live.saveReplay).to.be.false
      }
    })

    it('Delete the live', async function () {
      this.timeout(10000)

      await removeVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitJobs(servers)
    })

    it('Should have the live deleted', async function () {
      for (const server of servers) {
        await getVideo(server.url, liveVideoUUID, 404)
        await getLive(server.url, server.accessToken, liveVideoUUID, 404)
      }
    })
  })

  describe('Stream checks', function () {
    let liveVideo: LiveVideo & VideoDetails
    let rtmpUrl: string

    before(function () {
      rtmpUrl = 'rtmp://' + servers[0].hostname + ':1936'
    })

    async function createLiveWrapper () {
      const liveAttributes = {
        name: 'user live',
        channelId: userChannelId,
        privacy: VideoPrivacy.PUBLIC,
        saveReplay: false
      }

      const res = await createLive(servers[0].url, userAccessToken, liveAttributes)
      const uuid = res.body.video.uuid

      const resLive = await getLive(servers[0].url, servers[0].accessToken, uuid)
      const resVideo = await getVideo(servers[0].url, uuid)

      return Object.assign(resVideo.body, resLive.body) as LiveVideo & VideoDetails
    }

    it('Should not allow a stream without the appropriate path', async function () {
      this.timeout(30000)

      liveVideo = await createLiveWrapper()

      const command = sendRTMPStream(rtmpUrl + '/bad-live', liveVideo.streamKey)
      await testFfmpegStreamError(command, true)
    })

    it('Should not allow a stream without the appropriate stream key', async function () {
      this.timeout(30000)

      const command = sendRTMPStream(rtmpUrl + '/live', 'bad-stream-key')
      await testFfmpegStreamError(command, true)
    })

    it('Should succeed with the correct params', async function () {
      this.timeout(30000)

      const command = sendRTMPStream(rtmpUrl + '/live', liveVideo.streamKey)
      await testFfmpegStreamError(command, false)
    })

    it('Should not allow a stream on a live that was blacklisted', async function () {
      this.timeout(30000)

      liveVideo = await createLiveWrapper()

      await addVideoToBlacklist(servers[0].url, servers[0].accessToken, liveVideo.uuid)

      const command = sendRTMPStream(rtmpUrl + '/live', liveVideo.streamKey)
      await testFfmpegStreamError(command, true)
    })

    it('Should not allow a stream on a live that was deleted', async function () {
      this.timeout(30000)

      liveVideo = await createLiveWrapper()

      await removeVideo(servers[0].url, servers[0].accessToken, liveVideo.uuid)

      const command = sendRTMPStream(rtmpUrl + '/live', liveVideo.streamKey)
      await testFfmpegStreamError(command, true)
    })
  })

  describe('Live transcoding', function () {

    it('Should enable transcoding without additional resolutions', async function () {
      // enable
      // stream
      // wait federation + test

    })

    it('Should enable transcoding with some resolutions', async function () {
      // enable
      // stream
      // wait federation + test
    })

    it('Should enable transcoding with some resolutions and correctly save them', async function () {
      // enable
      // stream
      // end stream
      // wait federation + test
    })

    it('Should correctly have cleaned up the live files', async function () {
      // check files
    })
  })

  describe('Live socket messages', function () {

    it('Should correctly send a message when the live starts', async function () {
      // local
      // federation
    })

    it('Should correctly send a message when the live ends', async function () {
      // local
      // federation
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
