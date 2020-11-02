/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { LiveVideo, LiveVideoCreate, VideoDetails, VideoPrivacy } from '@shared/models'
import {
  acceptChangeOwnership,
  cleanupTests,
  createLive,
  doubleFollow,
  flushAndRunMultipleServers,
  getLive,
  getVideo,
  getVideosList,
  makeRawRequest,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testImage,
  updateCustomSubConfig,
  updateLive,
  waitJobs
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test live', function () {
  let servers: ServerInfo[] = []
  let liveVideoUUID: string

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      live: {
        enabled: true,
        allowReplay: true
      }
    })

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Live creation, update and delete', function () {

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

  describe('Test live constraints', function () {

    it('Should not have size limit if save replay is disabled', async function () {

    })

    it('Should have size limit if save replay is enabled', async function () {
      // daily quota + total quota

    })

    it('Should have max duration limit', async function () {

    })
  })

  describe('With save replay disabled', function () {

    it('Should correctly create and federate the "waiting for stream" live', async function () {

    })

    it('Should correctly have updated the live and federated it when streaming in the live', async function () {

    })

    it('Should correctly delete the video and the live after the stream ended', async function () {
      // Wait 10 seconds
      // get video 404
      // get video federation 404

      // check cleanup
    })

    it('Should correctly terminate the stream on blacklist and delete the live', async function () {
      // Wait 10 seconds
      // get video 404
      // get video federation 404

      // check cleanup
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      // Wait 10 seconds
      // get video 404
      // get video federation 404

      // check cleanup
    })
  })

  describe('With save replay enabled', function () {

    it('Should correctly create and federate the "waiting for stream" live', async function () {

    })

    it('Should correctly have updated the live and federated it when streaming in the live', async function () {

    })

    it('Should correctly have saved the live and federated it after the streaming', async function () {

    })

    it('Should update the saved live and correctly federate the updated attributes', async function () {

    })

    it('Should have cleaned up the live files', async function () {

    })

    it('Should correctly terminate the stream on blacklist and blacklist the saved replay video', async function () {
      // Wait 10 seconds
      // get video -> blacklisted
      // get video federation -> blacklisted

      // check cleanup live files quand meme
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      // Wait 10 seconds
      // get video 404
      // get video federation 404

      // check cleanup
    })
  })

  describe('Stream checks', function () {

    it('Should not allow a stream without the appropriate path', async function () {

    })

    it('Should not allow a stream without the appropriate stream key', async function () {

    })

    it('Should not allow a stream on a live that was blacklisted', async function () {

    })

    it('Should not allow a stream on a live that was deleted', async function () {

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
