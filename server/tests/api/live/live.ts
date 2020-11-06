/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { getLiveNotificationSocket } from '@shared/extra-utils/socket/socket-io'
import { LiveVideo, LiveVideoCreate, Video, VideoDetails, VideoPrivacy, VideoState, VideoStreamingPlaylistType } from '@shared/models'
import {
  addVideoToBlacklist,
  checkLiveCleanup,
  checkResolutionsInMasterPlaylist,
  cleanupTests,
  createLive,
  doubleFollow,
  flushAndRunMultipleServers,
  getLive,
  getVideo,
  getVideoIdFromUUID,
  getVideosList,
  makeRawRequest,
  removeVideo,
  sendRTMPStream,
  sendRTMPStreamInVideo,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  testFfmpegStreamError,
  testImage,
  updateCustomSubConfig,
  updateLive,
  viewVideo,
  wait,
  waitJobs,
  waitUntilLiveStarts
} from '../../../../shared/extra-utils'
import { FfmpegCommand } from 'fluent-ffmpeg'

const expect = chai.expect

describe('Test live', function () {
  let servers: ServerInfo[] = []

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
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.PUBLIC,
        saveReplay: false
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, liveAttributes)
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
    let liveVideoId: string

    async function createLiveWrapper (saveReplay: boolean) {
      const liveAttributes = {
        name: 'live video',
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.PUBLIC,
        saveReplay
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, liveAttributes)
      return res.body.video.uuid
    }

    async function testVideoResolutions (liveVideoId: string, resolutions: number[]) {
      for (const server of servers) {
        const resList = await getVideosList(server.url)
        const videos: Video[] = resList.body.data

        expect(videos.find(v => v.uuid === liveVideoId)).to.exist

        const resVideo = await getVideo(server.url, liveVideoId)
        const video: VideoDetails = resVideo.body

        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const hlsPlaylist = video.streamingPlaylists.find(s => s.type === VideoStreamingPlaylistType.HLS)
        expect(hlsPlaylist).to.exist

        // Only finite files are displayed
        expect(hlsPlaylist.files).to.have.lengthOf(0)

        await checkResolutionsInMasterPlaylist(hlsPlaylist.playlistUrl, resolutions)
      }
    }

    function updateConf (resolutions: number[]) {
      return updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: null,
          transcoding: {
            enabled: true,
            resolutions: {
              '240p': resolutions.includes(240),
              '360p': resolutions.includes(360),
              '480p': resolutions.includes(480),
              '720p': resolutions.includes(720),
              '1080p': resolutions.includes(1080),
              '2160p': resolutions.includes(2160)
            }
          }
        }
      })
    }

    before(async function () {
      await updateConf([])
    })

    it('Should enable transcoding without additional resolutions', async function () {
      this.timeout(30000)

      liveVideoId = await createLiveWrapper(false)

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLiveStarts(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitJobs(servers)

      await testVideoResolutions(liveVideoId, [ 720 ])

      await stopFfmpeg(command)
    })

    it('Should enable transcoding with some resolutions', async function () {
      this.timeout(30000)

      const resolutions = [ 240, 480 ]
      await updateConf(resolutions)
      liveVideoId = await createLiveWrapper(false)

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLiveStarts(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitJobs(servers)

      await testVideoResolutions(liveVideoId, resolutions)

      await stopFfmpeg(command)
    })

    it('Should enable transcoding with some resolutions and correctly save them', async function () {
      this.timeout(60000)

      const resolutions = [ 240, 360, 720 ]
      await updateConf(resolutions)
      liveVideoId = await createLiveWrapper(true)

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLiveStarts(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitJobs(servers)

      await testVideoResolutions(liveVideoId, resolutions)

      await stopFfmpeg(command)

      await waitJobs(servers)

      for (const server of servers) {
        const resVideo = await getVideo(server.url, liveVideoId)
        const video: VideoDetails = resVideo.body

        expect(video.duration).to.be.greaterThan(1)
        expect(video.files).to.have.lengthOf(0)

        const hlsPlaylist = video.streamingPlaylists.find(s => s.type === VideoStreamingPlaylistType.HLS)

        expect(hlsPlaylist.files).to.have.lengthOf(resolutions.length)

        for (const resolution of resolutions) {
          const file = hlsPlaylist.files.find(f => f.resolution.id === resolution)

          expect(file).to.exist
          expect(file.fps).to.equal(25)
          expect(file.size).to.be.greaterThan(1)

          await makeRawRequest(file.torrentUrl, 200)
          await makeRawRequest(file.fileUrl, 200)
        }
      }
    })

    it('Should correctly have cleaned up the live files', async function () {
      this.timeout(30000)

      await checkLiveCleanup(servers[0], liveVideoId, [ 240, 360, 720 ])
    })
  })

  describe('Live views', function () {
    let liveVideoId: string
    let command: FfmpegCommand

    async function countViews (expected: number) {
      for (const server of servers) {
        const res = await getVideo(server.url, liveVideoId)
        const video: VideoDetails = res.body

        expect(video.views).to.equal(expected)
      }
    }

    before(async function () {
      this.timeout(30000)

      const liveAttributes = {
        name: 'live video',
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.PUBLIC
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, liveAttributes)
      liveVideoId = res.body.video.uuid

      command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLiveStarts(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitJobs(servers)
    })

    it('Should display no views for a live', async function () {
      await countViews(0)
    })

    it('Should view a live twice and display 1 view', async function () {
      this.timeout(30000)

      await viewVideo(servers[0].url, liveVideoId)
      await viewVideo(servers[0].url, liveVideoId)

      await wait(5000)

      await waitJobs(servers)

      await countViews(1)
    })

    it('Should wait 5 seconds and display 0 views', async function () {
      this.timeout(30000)

      await wait(5000)
      await waitJobs(servers)

      await countViews(0)
    })

    it('Should view a live on a remote and on local and display 2 views', async function () {
      this.timeout(30000)

      await viewVideo(servers[0].url, liveVideoId)
      await viewVideo(servers[1].url, liveVideoId)
      await viewVideo(servers[1].url, liveVideoId)

      await wait(5000)
      await waitJobs(servers)

      await countViews(2)
    })

    after(async function () {
      await stopFfmpeg(command)
    })
  })

  describe('Live socket messages', function () {

    async function createLiveWrapper () {
      const liveAttributes = {
        name: 'live video',
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.PUBLIC
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, liveAttributes)
      return res.body.video.uuid
    }

    it('Should correctly send a message when the live starts and ends', async function () {
      this.timeout(60000)

      const localStateChanges: VideoState[] = []
      const remoteStateChanges: VideoState[] = []

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      {
        const videoId = await getVideoIdFromUUID(servers[0].url, liveVideoUUID)

        const localSocket = getLiveNotificationSocket(servers[0].url)
        localSocket.on('state-change', data => localStateChanges.push(data.state))
        localSocket.emit('subscribe', { videoId })
      }

      {
        const videoId = await getVideoIdFromUUID(servers[1].url, liveVideoUUID)

        const remoteSocket = getLiveNotificationSocket(servers[1].url)
        remoteSocket.on('state-change', data => remoteStateChanges.push(data.state))
        remoteSocket.emit('subscribe', { videoId })
      }

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLiveStarts(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitJobs(servers)

      for (const stateChanges of [ localStateChanges, remoteStateChanges ]) {
        expect(stateChanges).to.have.lengthOf(1)
        expect(stateChanges[0]).to.equal(VideoState.PUBLISHED)
      }

      await stopFfmpeg(command)
      await waitJobs(servers)

      for (const stateChanges of [ localStateChanges, remoteStateChanges ]) {
        expect(stateChanges).to.have.lengthOf(2)
        expect(stateChanges[1]).to.equal(VideoState.LIVE_ENDED)
      }
    })

    it('Should not receive a notification after unsubscribe', async function () {
      this.timeout(60000)

      const stateChanges: VideoState[] = []

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      const videoId = await getVideoIdFromUUID(servers[0].url, liveVideoUUID)

      const socket = getLiveNotificationSocket(servers[0].url)
      socket.on('state-change', data => stateChanges.push(data.state))
      socket.emit('subscribe', { videoId })

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLiveStarts(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitJobs(servers)

      expect(stateChanges).to.have.lengthOf(1)
      socket.emit('unsubscribe', { videoId })

      await stopFfmpeg(command)
      await waitJobs(servers)

      expect(stateChanges).to.have.lengthOf(1)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
