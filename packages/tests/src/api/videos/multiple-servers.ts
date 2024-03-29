/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoCommentPolicy, VideoCommentThreadTree, VideoPrivacy } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { dateIsValid, testImageGeneratedByFFmpeg } from '@tests/shared/checks.js'
import { checkTmpIsEmpty } from '@tests/shared/directories.js'
import { checkVideoFilesWereRemoved, completeVideoCheck, saveVideoInServers } from '@tests/shared/videos.js'
import { checkWebTorrentWorks } from '@tests/shared/webtorrent.js'
import { expect } from 'chai'
import request from 'supertest'

describe('Test multiple servers', function () {
  let servers: PeerTubeServer[] = []
  const toRemove = []
  let videoUUID = ''
  let videoChannelId: number

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const videoChannel = {
        name: 'super_channel_name',
        displayName: 'my channel',
        description: 'super channel'
      }
      await servers[0].channels.create({ attributes: videoChannel })
      await setDefaultChannelAvatar(servers[0], videoChannel.name)
      await setDefaultAccountAvatar(servers)

      const { data } = await servers[0].channels.list({ start: 0, count: 1 })
      videoChannelId = data[0].id
    }

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    // Server 1 and server 3 follow each other
    await doubleFollow(servers[0], servers[2])
    // Server 2 and server 3 follow each other
    await doubleFollow(servers[1], servers[2])
  })

  it('Should not have videos for all servers', async function () {
    for (const server of servers) {
      const { data } = await server.videos.list()
      expect(data).to.be.an('array')
      expect(data.length).to.equal(0)
    }
  })

  describe('Should upload the video and propagate on each server', function () {

    it('Should upload the video on server 1 and propagate on each server', async function () {
      this.timeout(60000)

      const attributes = {
        name: 'my super name for server 1',
        category: 5,
        licence: 4,
        language: 'ja',
        nsfw: true,
        description: 'my super description for server 1',
        support: 'my super support text for server 1',
        originallyPublishedAt: '2019-02-10T13:38:14.449Z',
        tags: [ 'tag1p1', 'tag2p1' ],
        channelId: videoChannelId,
        fixture: 'video_short1.webm'
      }
      await servers[0].videos.upload({ attributes })

      await waitJobs(servers)

      // All servers should have this video
      let publishedAt: string = null
      for (const server of servers) {
        const checkAttributes = {
          name: 'my super name for server 1',
          category: 5,
          licence: 4,
          language: 'ja',
          nsfw: true,
          description: 'my super description for server 1',
          support: 'my super support text for server 1',
          originallyPublishedAt: '2019-02-10T13:38:14.449Z',
          account: {
            name: 'root',
            host: servers[0].host
          },
          publishedAt,
          duration: 10,
          tags: [ 'tag1p1', 'tag2p1' ],
          privacy: VideoPrivacy.PUBLIC,
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          channel: {
            displayName: 'my channel',
            name: 'super_channel_name',
            description: 'super channel'
          },
          fixture: 'video_short1.webm',
          files: [
            {
              resolution: 720,
              height: 720,
              width: 1280,
              size: 572456
            }
          ]
        }

        const { data } = await server.videos.list()
        expect(data).to.be.an('array')
        expect(data.length).to.equal(1)
        const video = data[0]

        await completeVideoCheck({ server, originServer: servers[0], videoUUID: video.uuid, attributes: checkAttributes })
        publishedAt = video.publishedAt as string

        expect(video.channel.avatars).to.have.lengthOf(4)
        expect(video.account.avatars).to.have.lengthOf(4)

        for (const image of [ ...video.channel.avatars, ...video.account.avatars ]) {
          expect(image.createdAt).to.exist
          expect(image.updatedAt).to.exist
          expect(image.width).to.be.above(20).and.below(2000)
          expect(image.path).to.exist

          await makeGetRequest({
            url: server.url,
            path: image.path,
            expectedStatus: HttpStatusCode.OK_200
          })
        }
      }
    })

    it('Should upload the video on server 2 and propagate on each server', async function () {
      this.timeout(240000)

      const user = {
        username: 'user1',
        password: 'super_password'
      }
      await servers[1].users.create({ username: user.username, password: user.password })
      const userAccessToken = await servers[1].login.getAccessToken(user)

      const attributes = {
        name: 'my super name for server 2',
        category: 4,
        licence: 3,
        language: 'de',
        nsfw: true,
        description: 'my super description for server 2',
        support: 'my super support text for server 2',
        tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
        fixture: 'video_short2.webm',
        thumbnailfile: 'custom-thumbnail.jpg',
        previewfile: 'custom-preview.jpg'
      }
      await servers[1].videos.upload({ token: userAccessToken, attributes, mode: 'resumable' })

      // Transcoding
      await waitJobs(servers)

      // All servers should have this video
      for (const server of servers) {
        const checkAttributes = {
          name: 'my super name for server 2',
          category: 4,
          licence: 3,
          language: 'de',
          nsfw: true,
          description: 'my super description for server 2',
          support: 'my super support text for server 2',
          account: {
            name: 'user1',
            host: servers[1].host
          },
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          duration: 5,
          tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main user1 channel',
            name: 'user1_channel',
            description: 'super channel'
          },
          fixture: 'video_short2.webm',
          files: [
            {
              resolution: 240,
              height: 240,
              width: 426,
              size: 270000
            },
            {
              resolution: 360,
              height: 360,
              width: 640,
              size: 359000
            },
            {
              resolution: 480,
              height: 480,
              width: 854,
              size: 465000
            },
            {
              resolution: 720,
              height: 720,
              width: 1280,
              size: 750000
            }
          ],
          thumbnailfile: 'custom-thumbnail',
          previewfile: 'custom-preview'
        }

        const { data } = await server.videos.list()
        expect(data).to.be.an('array')
        expect(data.length).to.equal(2)
        const video = data[1]

        await completeVideoCheck({ server, originServer: servers[1], videoUUID: video.uuid, attributes: checkAttributes })
      }
    })

    it('Should upload two videos on server 3 and propagate on each server', async function () {
      this.timeout(45000)

      {
        const attributes = {
          name: 'my super name for server 3',
          category: 6,
          licence: 5,
          language: 'de',
          nsfw: true,
          description: 'my super description for server 3',
          support: 'my super support text for server 3',
          tags: [ 'tag1p3' ],
          fixture: 'video_short3.webm'
        }
        await servers[2].videos.upload({ attributes })
      }

      {
        const attributes = {
          name: 'my super name for server 3-2',
          category: 7,
          licence: 6,
          language: 'ko',
          nsfw: false,
          description: 'my super description for server 3-2',
          support: 'my super support text for server 3-2',
          tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
          fixture: 'video_short.webm'
        }
        await servers[2].videos.upload({ attributes })
      }

      await waitJobs(servers)

      // All servers should have this video
      for (const server of servers) {
        const { data } = await server.videos.list()

        expect(data).to.be.an('array')
        expect(data.length).to.equal(4)

        // We not sure about the order of the two last uploads
        let video1 = null
        let video2 = null
        if (data[2].name === 'my super name for server 3') {
          video1 = data[2]
          video2 = data[3]
        } else {
          video1 = data[3]
          video2 = data[2]
        }

        const checkAttributesVideo1 = {
          name: 'my super name for server 3',
          category: 6,
          licence: 5,
          language: 'de',
          nsfw: true,
          description: 'my super description for server 3',
          support: 'my super support text for server 3',
          account: {
            name: 'root',
            host: servers[2].host
          },
          duration: 5,
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          tags: [ 'tag1p3' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: ''
          },
          fixture: 'video_short3.webm',
          files: [
            {
              resolution: 720,
              height: 720,
              width: 1280,
              size: 292677
            }
          ]
        }
        await completeVideoCheck({ server, originServer: servers[2], videoUUID: video1.uuid, attributes: checkAttributesVideo1 })

        const checkAttributesVideo2 = {
          name: 'my super name for server 3-2',
          category: 7,
          licence: 6,
          language: 'ko',
          nsfw: false,
          description: 'my super description for server 3-2',
          support: 'my super support text for server 3-2',
          account: {
            name: 'root',
            host: servers[2].host
          },
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          duration: 5,
          tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: ''
          },
          fixture: 'video_short.webm',
          files: [
            {
              resolution: 720,
              height: 720,
              width: 1280,
              size: 218910
            }
          ]
        }
        await completeVideoCheck({ server, originServer: servers[2], videoUUID: video2.uuid, attributes: checkAttributesVideo2 })
      }
    })
  })

  describe('Local videos listing', function () {

    it('Should list only local videos on server 1', async function () {
      const { data, total } = await servers[0].videos.list({ isLocal: true })

      expect(total).to.equal(1)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(1)
      expect(data[0].name).to.equal('my super name for server 1')
    })

    it('Should list only local videos on server 2', async function () {
      const { data, total } = await servers[1].videos.list({ isLocal: true })

      expect(total).to.equal(1)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(1)
      expect(data[0].name).to.equal('my super name for server 2')
    })

    it('Should list only local videos on server 3', async function () {
      const { data, total } = await servers[2].videos.list({ isLocal: true })

      expect(total).to.equal(2)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(2)
      expect(data[0].name).to.equal('my super name for server 3')
      expect(data[1].name).to.equal('my super name for server 3-2')
    })
  })

  describe('All videos listing', function () {

    it('Should list and sort by "localVideoFilesSize"', async function () {
      const { data, total } = await servers[2].videos.list({ sort: '-localVideoFilesSize' })

      expect(total).to.equal(4)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(4)
      expect(data[0].name).to.equal('my super name for server 3')
      expect(data[1].name).to.equal('my super name for server 3-2')
      expect(data[2].isLocal).to.be.false
      expect(data[3].isLocal).to.be.false
    })
  })

  describe('Should seed the uploaded video', function () {

    it('Should add the file 1 by asking server 3', async function () {
      this.retries(2)
      this.timeout(30000)

      const { data } = await servers[2].videos.list()

      const video = data[0]
      toRemove.push(data[2])
      toRemove.push(data[3])

      const videoDetails = await servers[2].videos.get({ id: video.id })

      await checkWebTorrentWorks(videoDetails.files[0].magnetUri)
    })

    it('Should add the file 2 by asking server 1', async function () {
      this.retries(2)
      this.timeout(30000)

      const { data } = await servers[0].videos.list()

      const video = data[1]
      const videoDetails = await servers[0].videos.get({ id: video.id })

      await checkWebTorrentWorks(videoDetails.files[0].magnetUri)
    })

    it('Should add the file 3 by asking server 2', async function () {
      this.retries(2)
      this.timeout(30000)

      const { data } = await servers[1].videos.list()

      const video = data[2]
      const videoDetails = await servers[1].videos.get({ id: video.id })

      await checkWebTorrentWorks(videoDetails.files[0].magnetUri)
    })

    it('Should add the file 3-2 by asking server 1', async function () {
      this.retries(2)
      this.timeout(30000)

      const { data } = await servers[0].videos.list()

      const video = data[3]
      const videoDetails = await servers[0].videos.get({ id: video.id })

      await checkWebTorrentWorks(videoDetails.files[0].magnetUri)
    })

    it('Should add the file 2 in 360p by asking server 1', async function () {
      this.retries(2)
      this.timeout(30000)

      const { data } = await servers[0].videos.list()

      const video = data.find(v => v.name === 'my super name for server 2')
      const videoDetails = await servers[0].videos.get({ id: video.id })

      const file = videoDetails.files.find(f => f.resolution.id === 360)
      expect(file).not.to.be.undefined

      await checkWebTorrentWorks(file.magnetUri)
    })
  })

  describe('Should update video views, likes and dislikes', function () {
    let localVideosServer3 = []
    let remoteVideosServer1 = []
    let remoteVideosServer2 = []
    let remoteVideosServer3 = []

    before(async function () {
      {
        const { data } = await servers[0].videos.list()
        remoteVideosServer1 = data.filter(video => video.isLocal === false).map(video => video.uuid)
      }

      {
        const { data } = await servers[1].videos.list()
        remoteVideosServer2 = data.filter(video => video.isLocal === false).map(video => video.uuid)
      }

      {
        const { data } = await servers[2].videos.list()
        localVideosServer3 = data.filter(video => video.isLocal === true).map(video => video.uuid)
        remoteVideosServer3 = data.filter(video => video.isLocal === false).map(video => video.uuid)
      }
    })

    it('Should view multiple videos on owned servers', async function () {
      this.timeout(30000)

      await servers[2].views.simulateView({ id: localVideosServer3[0] })
      await wait(1000)

      await servers[2].views.simulateView({ id: localVideosServer3[0] })
      await servers[2].views.simulateView({ id: localVideosServer3[1] })

      await wait(1000)

      await servers[2].views.simulateView({ id: localVideosServer3[0] })
      await servers[2].views.simulateView({ id: localVideosServer3[0] })

      await waitJobs(servers)

      for (const server of servers) {
        await server.debug.sendCommand({ body: { command: 'process-video-views-buffer' } })
      }

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const video0 = data.find(v => v.uuid === localVideosServer3[0])
        const video1 = data.find(v => v.uuid === localVideosServer3[1])

        expect(video0.views).to.equal(3)
        expect(video1.views).to.equal(1)
      }
    })

    it('Should view multiple videos on each servers', async function () {
      this.timeout(45000)

      const tasks: Promise<any>[] = []
      tasks.push(servers[0].views.simulateView({ id: remoteVideosServer1[0] }))
      tasks.push(servers[1].views.simulateView({ id: remoteVideosServer2[0] }))
      tasks.push(servers[1].views.simulateView({ id: remoteVideosServer2[0] }))
      tasks.push(servers[2].views.simulateView({ id: remoteVideosServer3[0] }))
      tasks.push(servers[2].views.simulateView({ id: remoteVideosServer3[1] }))
      tasks.push(servers[2].views.simulateView({ id: remoteVideosServer3[1] }))
      tasks.push(servers[2].views.simulateView({ id: remoteVideosServer3[1] }))
      tasks.push(servers[2].views.simulateView({ id: localVideosServer3[1] }))
      tasks.push(servers[2].views.simulateView({ id: localVideosServer3[1] }))
      tasks.push(servers[2].views.simulateView({ id: localVideosServer3[1] }))

      await Promise.all(tasks)

      await waitJobs(servers)

      for (const server of servers) {
        await server.debug.sendCommand({ body: { command: 'process-video-views-buffer' } })
      }

      await waitJobs(servers)

      let baseVideos = null

      for (const server of servers) {
        const { data } = await server.videos.list()

        // Initialize base videos for future comparisons
        if (baseVideos === null) {
          baseVideos = data
          continue
        }

        for (const baseVideo of baseVideos) {
          const sameVideo = data.find(video => video.name === baseVideo.name)
          expect(baseVideo.views).to.equal(sameVideo.views)
        }
      }
    })

    it('Should like and dislikes videos on different services', async function () {
      this.timeout(50000)

      await servers[0].videos.rate({ id: remoteVideosServer1[0], rating: 'like' })
      await wait(500)
      await servers[0].videos.rate({ id: remoteVideosServer1[0], rating: 'dislike' })
      await wait(500)
      await servers[0].videos.rate({ id: remoteVideosServer1[0], rating: 'like' })
      await servers[2].videos.rate({ id: localVideosServer3[1], rating: 'like' })
      await wait(500)
      await servers[2].videos.rate({ id: localVideosServer3[1], rating: 'dislike' })
      await servers[2].videos.rate({ id: remoteVideosServer3[1], rating: 'dislike' })
      await wait(500)
      await servers[2].videos.rate({ id: remoteVideosServer3[0], rating: 'like' })

      await waitJobs(servers)
      await wait(5000)
      await waitJobs(servers)

      let baseVideos = null
      for (const server of servers) {
        const { data } = await server.videos.list()

        // Initialize base videos for future comparisons
        if (baseVideos === null) {
          baseVideos = data
          continue
        }

        for (const baseVideo of baseVideos) {
          const sameVideo = data.find(video => video.name === baseVideo.name)
          expect(baseVideo.likes).to.equal(sameVideo.likes, `Likes of ${sameVideo.uuid} do not correspond`)
          expect(baseVideo.dislikes).to.equal(sameVideo.dislikes, `Dislikes of ${sameVideo.uuid} do not correspond`)
        }
      }
    })
  })

  describe('Should manipulate these videos', function () {
    let updatedAtMin: Date

    it('Should update video 3', async function () {
      this.timeout(30000)

      const attributes = {
        name: 'my super video updated',
        category: 10,
        licence: 7,
        language: 'fr',
        nsfw: true,
        description: 'my super description updated',
        support: 'my super support text updated',
        tags: [ 'tag_up_1', 'tag_up_2' ],
        thumbnailfile: 'custom-thumbnail.jpg',
        originallyPublishedAt: '2019-02-11T13:38:14.449Z',
        previewfile: 'custom-preview.jpg'
      }

      updatedAtMin = new Date()
      await servers[2].videos.update({ id: toRemove[0].id, attributes })

      await waitJobs(servers)
    })

    it('Should have the video 3 updated on each server', async function () {
      this.timeout(30000)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const videoUpdated = data.find(video => video.name === 'my super video updated')
        expect(!!videoUpdated).to.be.true

        expect(new Date(videoUpdated.updatedAt)).to.be.greaterThan(updatedAtMin)

        const checkAttributes = {
          name: 'my super video updated',
          category: 10,
          licence: 7,
          language: 'fr',
          nsfw: true,
          description: 'my super description updated',
          support: 'my super support text updated',
          originallyPublishedAt: '2019-02-11T13:38:14.449Z',
          account: {
            name: 'root',
            host: servers[2].host
          },
          duration: 5,
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          tags: [ 'tag_up_1', 'tag_up_2' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: ''
          },
          fixture: 'video_short3.webm',
          files: [
            {
              resolution: 720,
              height: 720,
              width: 1280,
              size: 292677
            }
          ],
          thumbnailfile: 'custom-thumbnail',
          previewfile: 'custom-preview'
        }
        await completeVideoCheck({ server, originServer: servers[2], videoUUID: videoUpdated.uuid, attributes: checkAttributes })
      }
    })

    it('Should be able to remove originallyPublishedAt attribute', async function () {
      this.timeout(60000)

      const attributes = { originallyPublishedAt: null }
      await servers[2].videos.update({ id: toRemove[0].id, attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: toRemove[0].uuid })

        expect(video.originallyPublishedAt).to.not.exist
      }
    })

    it('Should only update thumbnail and update updatedAt attribute', async function () {
      this.timeout(30000)

      const attributes = {
        thumbnailfile: 'custom-thumbnail.jpg'
      }

      updatedAtMin = new Date()
      await servers[2].videos.update({ id: toRemove[0].id, attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const videoUpdated = data.find(video => video.name === 'my super video updated')
        expect(new Date(videoUpdated.updatedAt)).to.be.greaterThan(updatedAtMin)
      }
    })

    it('Should remove the videos 3 and 3-2 by asking server 3 and correctly delete files', async function () {
      this.timeout(30000)

      for (const id of [ toRemove[0].id, toRemove[1].id ]) {
        await saveVideoInServers(servers, id)

        await servers[2].videos.remove({ id })

        await waitJobs(servers)

        for (const server of servers) {
          await checkVideoFilesWereRemoved({ server, video: server.store.videoDetails })
        }
      }
    })

    it('Should have videos 1 and 3 on each server', async function () {
      for (const server of servers) {
        const { data } = await server.videos.list()

        expect(data).to.be.an('array')
        expect(data.length).to.equal(2)
        expect(data[0].name).not.to.equal(data[1].name)
        expect(data[0].name).not.to.equal(toRemove[0].name)
        expect(data[1].name).not.to.equal(toRemove[0].name)
        expect(data[0].name).not.to.equal(toRemove[1].name)
        expect(data[1].name).not.to.equal(toRemove[1].name)

        videoUUID = data.find(video => video.name === 'my super name for server 1').uuid
      }
    })

    it('Should get the same video by UUID on each server', async function () {
      let baseVideo = null
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        if (baseVideo === null) {
          baseVideo = video
          continue
        }

        expect(baseVideo.name).to.equal(video.name)
        expect(baseVideo.uuid).to.equal(video.uuid)
        expect(baseVideo.category.id).to.equal(video.category.id)
        expect(baseVideo.language.id).to.equal(video.language.id)
        expect(baseVideo.licence.id).to.equal(video.licence.id)
        expect(baseVideo.nsfw).to.equal(video.nsfw)
        expect(baseVideo.account.name).to.equal(video.account.name)
        expect(baseVideo.account.displayName).to.equal(video.account.displayName)
        expect(baseVideo.account.url).to.equal(video.account.url)
        expect(baseVideo.account.host).to.equal(video.account.host)
        expect(baseVideo.tags).to.deep.equal(video.tags)
      }
    })

    it('Should get the preview from each server', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        await testImageGeneratedByFFmpeg(server.url, 'video_short1-preview.webm', video.previewPath)
      }
    })
  })

  describe('Should comment these videos', function () {
    let childOfFirstChild: VideoCommentThreadTree

    it('Should add comment (threads and replies)', async function () {
      this.timeout(25000)

      {
        const text = 'my super first comment'
        await servers[0].comments.createThread({ videoId: videoUUID, text })
      }

      {
        const text = 'my super second comment'
        await servers[2].comments.createThread({ videoId: videoUUID, text })
      }

      await waitJobs(servers)

      {
        const threadId = await servers[1].comments.findCommentId({ videoId: videoUUID, text: 'my super first comment' })

        const text = 'my super answer to thread 1'
        await servers[1].comments.addReply({ videoId: videoUUID, toCommentId: threadId, text })
      }

      await waitJobs(servers)

      {
        const threadId = await servers[2].comments.findCommentId({ videoId: videoUUID, text: 'my super first comment' })

        const body = await servers[2].comments.getThread({ videoId: videoUUID, threadId })
        const childCommentId = body.children[0].comment.id

        const text3 = 'my second answer to thread 1'
        await servers[2].comments.addReply({ videoId: videoUUID, toCommentId: threadId, text: text3 })

        const text2 = 'my super answer to answer of thread 1'
        await servers[2].comments.addReply({ videoId: videoUUID, toCommentId: childCommentId, text: text2 })
      }

      await waitJobs(servers)
    })

    it('Should have these threads', async function () {
      for (const server of servers) {
        const body = await server.comments.listThreads({ videoId: videoUUID })

        expect(body.total).to.equal(2)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(2)

        {
          const comment = body.data.find(c => c.text === 'my super first comment')
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal(servers[0].host)
          expect(comment.totalReplies).to.equal(3)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }

        {
          const comment = body.data.find(c => c.text === 'my super second comment')
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal(servers[2].host)
          expect(comment.totalReplies).to.equal(0)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }
      }
    })

    it('Should have these comments', async function () {
      for (const server of servers) {
        const body = await server.comments.listThreads({ videoId: videoUUID })
        const threadId = body.data.find(c => c.text === 'my super first comment').id

        const tree = await server.comments.getThread({ videoId: videoUUID, threadId })

        expect(tree.comment.text).equal('my super first comment')
        expect(tree.comment.account.name).equal('root')
        expect(tree.comment.account.host).equal(servers[0].host)
        expect(tree.children).to.have.lengthOf(2)

        const firstChild = tree.children[0]
        expect(firstChild.comment.text).to.equal('my super answer to thread 1')
        expect(firstChild.comment.account.name).equal('root')
        expect(firstChild.comment.account.host).equal(servers[1].host)
        expect(firstChild.children).to.have.lengthOf(1)

        childOfFirstChild = firstChild.children[0]
        expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
        expect(childOfFirstChild.comment.account.name).equal('root')
        expect(childOfFirstChild.comment.account.host).equal(servers[2].host)
        expect(childOfFirstChild.children).to.have.lengthOf(0)

        const secondChild = tree.children[1]
        expect(secondChild.comment.text).to.equal('my second answer to thread 1')
        expect(secondChild.comment.account.name).equal('root')
        expect(secondChild.comment.account.host).equal(servers[2].host)
        expect(secondChild.children).to.have.lengthOf(0)
      }
    })

    it('Should delete a reply', async function () {
      this.timeout(30000)

      await servers[2].comments.delete({ videoId: videoUUID, commentId: childOfFirstChild.comment.id })

      await waitJobs(servers)
    })

    it('Should have this comment marked as deleted', async function () {
      for (const server of servers) {
        const { data } = await server.comments.listThreads({ videoId: videoUUID })
        const threadId = data.find(c => c.text === 'my super first comment').id

        const tree = await server.comments.getThread({ videoId: videoUUID, threadId })
        expect(tree.comment.text).equal('my super first comment')

        const firstChild = tree.children[0]
        expect(firstChild.comment.text).to.equal('my super answer to thread 1')
        expect(firstChild.children).to.have.lengthOf(1)

        const deletedComment = firstChild.children[0].comment
        expect(deletedComment.isDeleted).to.be.true
        expect(deletedComment.deletedAt).to.not.be.null
        expect(deletedComment.account).to.be.null
        expect(deletedComment.text).to.equal('')

        const secondChild = tree.children[1]
        expect(secondChild.comment.text).to.equal('my second answer to thread 1')
      }
    })

    it('Should delete the thread comments', async function () {
      this.timeout(30000)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      const commentId = data.find(c => c.text === 'my super first comment').id
      await servers[0].comments.delete({ videoId: videoUUID, commentId })

      await waitJobs(servers)
    })

    it('Should have the threads marked as deleted on other servers too', async function () {
      for (const server of servers) {
        const body = await server.comments.listThreads({ videoId: videoUUID })

        expect(body.total).to.equal(2)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(2)

        {
          const comment = body.data[0]
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal(servers[2].host)
          expect(comment.totalReplies).to.equal(0)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }

        {
          const deletedComment = body.data[1]
          expect(deletedComment).to.not.be.undefined
          expect(deletedComment.isDeleted).to.be.true
          expect(deletedComment.deletedAt).to.not.be.null
          expect(deletedComment.text).to.equal('')
          expect(deletedComment.inReplyToCommentId).to.be.null
          expect(deletedComment.account).to.be.null
          expect(deletedComment.totalReplies).to.equal(2)
          expect(dateIsValid(deletedComment.createdAt as string)).to.be.true
          expect(dateIsValid(deletedComment.updatedAt as string)).to.be.true
          expect(dateIsValid(deletedComment.deletedAt as string)).to.be.true
        }
      }
    })

    it('Should delete a remote thread by the origin server', async function () {
      this.timeout(5000)

      const { data } = await servers[0].comments.listThreads({ videoId: videoUUID })
      const commentId = data.find(c => c.text === 'my super second comment').id
      await servers[0].comments.delete({ videoId: videoUUID, commentId })

      await waitJobs(servers)
    })

    it('Should have the threads marked as deleted on other servers too', async function () {
      for (const server of servers) {
        const body = await server.comments.listThreads({ videoId: videoUUID })

        expect(body.total).to.equal(2)
        expect(body.data).to.have.lengthOf(2)

        {
          const comment = body.data[0]
          expect(comment.text).to.equal('')
          expect(comment.isDeleted).to.be.true
          expect(comment.createdAt).to.not.be.null
          expect(comment.deletedAt).to.not.be.null
          expect(comment.account).to.be.null
          expect(comment.totalReplies).to.equal(0)
        }

        {
          const comment = body.data[1]
          expect(comment.text).to.equal('')
          expect(comment.isDeleted).to.be.true
          expect(comment.createdAt).to.not.be.null
          expect(comment.deletedAt).to.not.be.null
          expect(comment.account).to.be.null
          expect(comment.totalReplies).to.equal(2)
        }
      }
    })

    it('Should disable comments and download', async function () {
      this.timeout(20000)

      const attributes = {
        commentsPolicy: VideoCommentPolicy.DISABLED,
        downloadEnabled: false
      }

      await servers[0].videos.update({ id: videoUUID, attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.commentsEnabled).to.be.false
        expect(video.commentsPolicy.id).to.equal(VideoCommentPolicy.DISABLED)
        expect(video.commentsPolicy.label).to.equal('Disabled')
        expect(video.downloadEnabled).to.be.false

        const text = 'my super forbidden comment'
        await server.comments.createThread({ videoId: videoUUID, text, expectedStatus: HttpStatusCode.CONFLICT_409 })
      }
    })
  })

  describe('With minimum parameters', function () {
    it('Should upload and propagate the video', async function () {
      this.timeout(240000)

      const path = '/api/v1/videos/upload'

      const req = request(servers[1].url)
        .post(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + servers[1].accessToken)
        .field('name', 'minimum parameters')
        .field('privacy', '1')
        .field('channelId', '1')

      await req.attach('videofile', buildAbsoluteFixturePath('video_short.webm'))
               .expect(HttpStatusCode.OK_200)

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()
        const video = data.find(v => v.name === 'minimum parameters')

        const isLocal = server.url === servers[1].url
        const checkAttributes = {
          name: 'minimum parameters',
          category: null,
          licence: null,
          language: null,
          nsfw: false,
          description: null,
          support: null,
          account: {
            name: 'root',
            host: servers[1].host
          },
          isLocal,
          duration: 5,
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          tags: [],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: '',
            isLocal
          },
          fixture: 'video_short.webm',
          files: [
            {
              resolution: 720,
              height: 720,
              width: 1280,
              size: 61000
            },
            {
              resolution: 480,
              height: 480,
              width: 854,
              size: 40000
            },
            {
              resolution: 360,
              height: 360,
              width: 640,
              size: 32000
            },
            {
              resolution: 240,
              height: 240,
              width: 426,
              size: 23000
            }
          ]
        }
        await completeVideoCheck({ server, originServer: servers[1], videoUUID: video.uuid, attributes: checkAttributes })
      }
    })
  })

  describe('TMP directory', function () {
    it('Should have an empty tmp directory', async function () {
      for (const server of servers) {
        await checkTmpIsEmpty(server)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
