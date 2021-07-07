/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { join } from 'path'
import { ffprobePromise, getVideoStreamFromFile } from '@server/helpers/ffprobe-utils'
import { LiveVideo, LiveVideoCreate, Video, VideoDetails, VideoPrivacy, VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  addVideoToBlacklist,
  buildServerDirectory,
  checkLiveCleanup,
  checkLiveSegmentHash,
  checkResolutionsInMasterPlaylist,
  cleanupTests,
  createLive,
  doubleFollow,
  flushAndRunMultipleServers,
  getLive,
  getMyVideosWithFilter,
  getPlaylist,
  getVideo,
  getVideosList,
  getVideosWithFilters,
  killallServers,
  makeRawRequest,
  removeVideo,
  reRunServer,
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
  uploadVideoAndGetId,
  wait,
  waitJobs,
  waitUntilLiveEnded,
  waitUntilLivePublished,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveSegmentGeneration
} from '../../../../shared/extra-utils'

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

        expect(video.isLive).to.be.true

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
          expect(live.rtmpUrl).to.equal('rtmp://' + server.hostname + ':' + servers[0].rtmpPort + '/live')
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

        await makeRawRequest(server.url + video.thumbnailPath, HttpStatusCode.OK_200)
        await makeRawRequest(server.url + video.previewPath, HttpStatusCode.OK_200)
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
      await updateLive(servers[1].url, servers[1].accessToken, liveVideoUUID, { saveReplay: false }, HttpStatusCode.FORBIDDEN_403)
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
          expect(live.rtmpUrl).to.equal('rtmp://' + server.hostname + ':' + servers[0].rtmpPort + '/live')
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
        await getVideo(server.url, liveVideoUUID, HttpStatusCode.NOT_FOUND_404)
        await getLive(server.url, server.accessToken, liveVideoUUID, HttpStatusCode.NOT_FOUND_404)
      }
    })
  })

  describe('Live filters', function () {
    let command: any
    let liveVideoId: string
    let vodVideoId: string

    before(async function () {
      this.timeout(120000)

      vodVideoId = (await uploadVideoAndGetId({ server: servers[0], videoName: 'vod video' })).uuid

      const liveOptions = { name: 'live', privacy: VideoPrivacy.PUBLIC, channelId: servers[0].videoChannel.id }
      const resLive = await createLive(servers[0].url, servers[0].accessToken, liveOptions)
      liveVideoId = resLive.body.video.uuid

      command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLivePublishedOnAllServers(servers, liveVideoId)
      await waitJobs(servers)
    })

    it('Should only display lives', async function () {
      const res = await getVideosWithFilters(servers[0].url, { isLive: true })

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].name).to.equal('live')
    })

    it('Should not display lives', async function () {
      const res = await getVideosWithFilters(servers[0].url, { isLive: false })

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].name).to.equal('vod video')
    })

    it('Should display my lives', async function () {
      this.timeout(60000)

      await stopFfmpeg(command)
      await waitJobs(servers)

      const res = await getMyVideosWithFilter(servers[0].url, servers[0].accessToken, { isLive: true })
      const videos = res.body.data as Video[]

      const result = videos.every(v => v.isLive)
      expect(result).to.be.true
    })

    it('Should not display my lives', async function () {
      const res = await getMyVideosWithFilter(servers[0].url, servers[0].accessToken, { isLive: false })
      const videos = res.body.data as Video[]

      const result = videos.every(v => !v.isLive)
      expect(result).to.be.true
    })

    after(async function () {
      await removeVideo(servers[0].url, servers[0].accessToken, vodVideoId)
      await removeVideo(servers[0].url, servers[0].accessToken, liveVideoId)
    })
  })

  describe('Stream checks', function () {
    let liveVideo: LiveVideo & VideoDetails
    let rtmpUrl: string

    before(function () {
      rtmpUrl = 'rtmp://' + servers[0].hostname + ':' + servers[0].rtmpPort + ''
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
      this.timeout(60000)

      liveVideo = await createLiveWrapper()

      const command = sendRTMPStream(rtmpUrl + '/bad-live', liveVideo.streamKey)
      await testFfmpegStreamError(command, true)
    })

    it('Should not allow a stream without the appropriate stream key', async function () {
      this.timeout(60000)

      const command = sendRTMPStream(rtmpUrl + '/live', 'bad-stream-key')
      await testFfmpegStreamError(command, true)
    })

    it('Should succeed with the correct params', async function () {
      this.timeout(60000)

      const command = sendRTMPStream(rtmpUrl + '/live', liveVideo.streamKey)
      await testFfmpegStreamError(command, false)
    })

    it('Should list this live now someone stream into it', async function () {
      for (const server of servers) {
        const res = await getVideosList(server.url)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)

        const video: Video = res.body.data[0]

        expect(video.name).to.equal('user live')
        expect(video.isLive).to.be.true
      }
    })

    it('Should not allow a stream on a live that was blacklisted', async function () {
      this.timeout(60000)

      liveVideo = await createLiveWrapper()

      await addVideoToBlacklist(servers[0].url, servers[0].accessToken, liveVideo.uuid)

      const command = sendRTMPStream(rtmpUrl + '/live', liveVideo.streamKey)
      await testFfmpegStreamError(command, true)
    })

    it('Should not allow a stream on a live that was deleted', async function () {
      this.timeout(60000)

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

        for (let i = 0; i < resolutions.length; i++) {
          const segmentNum = 3
          const segmentName = `${i}-00000${segmentNum}.ts`
          await waitUntilLiveSegmentGeneration(servers[0], video.uuid, i, segmentNum)

          const res = await getPlaylist(`${servers[0].url}/static/streaming-playlists/hls/${video.uuid}/${i}.m3u8`)
          const subPlaylist = res.text

          expect(subPlaylist).to.contain(segmentName)

          const baseUrlAndPath = servers[0].url + '/static/streaming-playlists/hls'
          await checkLiveSegmentHash(baseUrlAndPath, video.uuid, segmentName, hlsPlaylist)
        }
      }
    }

    function updateConf (resolutions: number[]) {
      return updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: -1,
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
      this.timeout(60000)

      liveVideoId = await createLiveWrapper(false)

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLivePublishedOnAllServers(servers, liveVideoId)
      await waitJobs(servers)

      await testVideoResolutions(liveVideoId, [ 720 ])

      await stopFfmpeg(command)
    })

    it('Should enable transcoding with some resolutions', async function () {
      this.timeout(60000)

      const resolutions = [ 240, 480 ]
      await updateConf(resolutions)
      liveVideoId = await createLiveWrapper(false)

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId)
      await waitUntilLivePublishedOnAllServers(servers, liveVideoId)
      await waitJobs(servers)

      await testVideoResolutions(liveVideoId, resolutions)

      await stopFfmpeg(command)
    })

    it('Should enable transcoding with some resolutions and correctly save them', async function () {
      this.timeout(200000)

      const resolutions = [ 240, 360, 720 ]

      await updateConf(resolutions)
      liveVideoId = await createLiveWrapper(true)

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId, 'video_short2.webm')
      await waitUntilLivePublishedOnAllServers(servers, liveVideoId)
      await waitJobs(servers)

      await testVideoResolutions(liveVideoId, resolutions)

      await stopFfmpeg(command)
      await waitUntilLiveEnded(servers[0].url, servers[0].accessToken, liveVideoId)

      await waitJobs(servers)

      await waitUntilLivePublishedOnAllServers(servers, liveVideoId)

      const bitrateLimits = {
        720: 5000 * 1000, // 60FPS
        360: 1100 * 1000,
        240: 600 * 1000
      }

      for (const server of servers) {
        const resVideo = await getVideo(server.url, liveVideoId)
        const video: VideoDetails = resVideo.body

        expect(video.state.id).to.equal(VideoState.PUBLISHED)
        expect(video.duration).to.be.greaterThan(1)
        expect(video.files).to.have.lengthOf(0)

        const hlsPlaylist = video.streamingPlaylists.find(s => s.type === VideoStreamingPlaylistType.HLS)
        await makeRawRequest(hlsPlaylist.playlistUrl, HttpStatusCode.OK_200)
        await makeRawRequest(hlsPlaylist.segmentsSha256Url, HttpStatusCode.OK_200)

        expect(hlsPlaylist.files).to.have.lengthOf(resolutions.length)

        for (const resolution of resolutions) {
          const file = hlsPlaylist.files.find(f => f.resolution.id === resolution)

          expect(file).to.exist
          expect(file.size).to.be.greaterThan(1)

          if (resolution >= 720) {
            expect(file.fps).to.be.approximately(60, 2)
          } else {
            expect(file.fps).to.be.approximately(30, 2)
          }

          const filename = `${video.uuid}-${resolution}-fragmented.mp4`
          const segmentPath = buildServerDirectory(servers[0], join('streaming-playlists', 'hls', video.uuid, filename))

          const probe = await ffprobePromise(segmentPath)
          const videoStream = await getVideoStreamFromFile(segmentPath, probe)

          expect(probe.format.bit_rate).to.be.below(bitrateLimits[videoStream.height])

          await makeRawRequest(file.torrentUrl, HttpStatusCode.OK_200)
          await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)
        }
      }
    })

    it('Should correctly have cleaned up the live files', async function () {
      this.timeout(30000)

      await checkLiveCleanup(servers[0], liveVideoId, [ 240, 360, 720 ])
    })
  })

  describe('After a server restart', function () {
    let liveVideoId: string
    let liveVideoReplayId: string

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

    before(async function () {
      this.timeout(120000)

      liveVideoId = await createLiveWrapper(false)
      liveVideoReplayId = await createLiveWrapper(true)

      await Promise.all([
        sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoId),
        sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoReplayId)
      ])

      await Promise.all([
        waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoId),
        waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoReplayId)
      ])

      await waitUntilLiveSegmentGeneration(servers[0], liveVideoId, 0, 2)
      await waitUntilLiveSegmentGeneration(servers[0], liveVideoReplayId, 0, 2)

      await killallServers([ servers[0] ])
      await reRunServer(servers[0])

      await wait(5000)
    })

    it('Should cleanup lives', async function () {
      this.timeout(60000)

      await waitUntilLiveEnded(servers[0].url, servers[0].accessToken, liveVideoId)
    })

    it('Should save a live replay', async function () {
      this.timeout(120000)

      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoReplayId)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
