/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { Video, VideoCommentPolicy, VideoPrivacy } from '@peertube/peertube-models'
import { checkVideoFilesWereRemoved, completeVideoCheck } from '@tests/shared/videos.js'
import { testImageGeneratedByFFmpeg } from '@tests/shared/checks.js'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test a single server', function () {

  function runSuite (mode: 'legacy' | 'resumable') {
    let server: PeerTubeServer = null
    let videoId: number | string
    let videoId2: string
    let videoUUID = ''
    let videosListBase: any[] = null

    const getCheckAttributes = () => ({
      name: 'my super name',
      category: 2,
      licence: 6,
      language: 'zh',
      nsfw: true,
      description: 'my super description',
      support: 'my super support text',
      account: {
        name: 'root',
        host: server.host
      },
      duration: 5,
      tags: [ 'tag1', 'tag2', 'tag3' ],
      privacy: VideoPrivacy.PUBLIC,
      commentsPolicy: VideoCommentPolicy.ENABLED,
      downloadEnabled: true,
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
    })

    const updateCheckAttributes = () => ({
      name: 'my super video updated',
      category: 4,
      licence: 2,
      language: 'ar',
      nsfw: false,
      description: 'my super description updated',
      support: 'my super support text updated',
      account: {
        name: 'root',
        host: server.host
      },
      tags: [ 'tagup1', 'tagup2' ],
      privacy: VideoPrivacy.PUBLIC,
      duration: 5,
      commentsPolicy: VideoCommentPolicy.DISABLED,
      downloadEnabled: false,
      channel: {
        name: 'root_channel',
        displayName: 'Main root channel',
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
    })

    before(async function () {
      this.timeout(30000)

      server = await createSingleServer(1, {})

      await setAccessTokensToServers([ server ])
      await setDefaultChannelAvatar(server)
      await setDefaultAccountAvatar(server)
    })

    it('Should list video categories', async function () {
      const categories = await server.videos.getCategories()
      expect(Object.keys(categories)).to.have.length.above(10)

      expect(categories[11]).to.equal('News & Politics')
    })

    it('Should list video licences', async function () {
      const licences = await server.videos.getLicences()
      expect(Object.keys(licences)).to.have.length.above(5)

      expect(licences[3]).to.equal('Attribution - No Derivatives')
    })

    it('Should list video languages', async function () {
      const languages = await server.videos.getLanguages()
      expect(Object.keys(languages)).to.have.length.above(5)

      expect(languages['ru']).to.equal('Russian')
    })

    it('Should list video privacies', async function () {
      const privacies = await server.videos.getPrivacies()
      expect(Object.keys(privacies)).to.have.length.at.least(3)

      expect(privacies[3]).to.equal('Private')
    })

    it('Should not have videos', async function () {
      const { data, total } = await server.videos.list()

      expect(total).to.equal(0)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(0)
    })

    it('Should upload the video', async function () {
      const attributes = {
        name: 'my super name',
        category: 2,
        nsfw: true,
        licence: 6,
        tags: [ 'tag1', 'tag2', 'tag3' ]
      }
      const video = await server.videos.upload({ attributes, mode })
      expect(video).to.not.be.undefined
      expect(video.id).to.equal(1)
      expect(video.uuid).to.have.length.above(5)

      videoId = video.id
      videoUUID = video.uuid
    })

    it('Should get and seed the uploaded video', async function () {
      this.timeout(5000)

      const { data, total } = await server.videos.list()

      expect(total).to.equal(1)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(1)

      const video = data[0]
      await completeVideoCheck({ server, originServer: server, videoUUID: video.uuid, attributes: getCheckAttributes() })
    })

    it('Should get the video by UUID', async function () {
      this.timeout(5000)

      const video = await server.videos.get({ id: videoUUID })
      await completeVideoCheck({ server, originServer: server, videoUUID: video.uuid, attributes: getCheckAttributes() })
    })

    it('Should have the views updated', async function () {
      this.timeout(20000)

      await server.views.simulateView({ id: videoId })
      await server.views.simulateView({ id: videoId })
      await server.views.simulateView({ id: videoId })

      await wait(1500)

      await server.views.simulateView({ id: videoId })
      await server.views.simulateView({ id: videoId })

      await wait(1500)

      await server.views.simulateView({ id: videoId })
      await server.views.simulateView({ id: videoId })

      await server.debug.sendCommand({ body: { command: 'process-video-views-buffer' } })

      const video = await server.videos.get({ id: videoId })
      expect(video.views).to.equal(3)
    })

    it('Should remove the video', async function () {
      const video = await server.videos.get({ id: videoId })
      await server.videos.remove({ id: videoId })

      await checkVideoFilesWereRemoved({ video, server })
    })

    it('Should not have videos', async function () {
      const { total, data } = await server.videos.list()

      expect(total).to.equal(0)
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(0)
    })

    it('Should upload 6 videos', async function () {
      this.timeout(120000)

      const videos = new Set([
        'video_short.mp4', 'video_short.ogv', 'video_short.webm',
        'video_short1.webm', 'video_short2.webm', 'video_short3.webm'
      ])

      for (const video of videos) {
        const attributes = {
          name: video + ' name',
          description: video + ' description',
          category: 2,
          licence: 1,
          language: 'en',
          nsfw: true,
          tags: [ 'tag1', 'tag2', 'tag3' ],
          fixture: video
        }

        await server.videos.upload({ attributes, mode })
      }
    })

    it('Should have the correct durations', async function () {
      const { total, data } = await server.videos.list()

      expect(total).to.equal(6)
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(6)

      const videosByName: { [ name: string ]: Video } = {}
      data.forEach(v => { videosByName[v.name] = v })

      expect(videosByName['video_short.mp4 name'].duration).to.equal(5)
      expect(videosByName['video_short.ogv name'].duration).to.equal(5)
      expect(videosByName['video_short.webm name'].duration).to.equal(5)
      expect(videosByName['video_short1.webm name'].duration).to.equal(10)
      expect(videosByName['video_short2.webm name'].duration).to.equal(5)
      expect(videosByName['video_short3.webm name'].duration).to.equal(5)
    })

    it('Should have the correct thumbnails', async function () {
      const { data } = await server.videos.list()

      // For the next test
      videosListBase = data

      for (const video of data) {
        const videoName = video.name.replace(' name', '')
        await testImageGeneratedByFFmpeg(server.url, videoName, video.thumbnailPath)
      }
    })

    it('Should list only the two first videos', async function () {
      const { total, data } = await server.videos.list({ start: 0, count: 2, sort: 'name' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(2)
      expect(data[0].name).to.equal(videosListBase[0].name)
      expect(data[1].name).to.equal(videosListBase[1].name)
    })

    it('Should list only the next three videos', async function () {
      const { total, data } = await server.videos.list({ start: 2, count: 3, sort: 'name' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(3)
      expect(data[0].name).to.equal(videosListBase[2].name)
      expect(data[1].name).to.equal(videosListBase[3].name)
      expect(data[2].name).to.equal(videosListBase[4].name)
    })

    it('Should list the last video', async function () {
      const { total, data } = await server.videos.list({ start: 5, count: 6, sort: 'name' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(1)
      expect(data[0].name).to.equal(videosListBase[5].name)
    })

    it('Should not have the total field', async function () {
      const { total, data } = await server.videos.list({ start: 5, count: 6, sort: 'name', skipCount: true })

      expect(total).to.not.exist
      expect(data.length).to.equal(1)
      expect(data[0].name).to.equal(videosListBase[5].name)
    })

    it('Should list and sort by name in descending order', async function () {
      const { total, data } = await server.videos.list({ sort: '-name' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(6)
      expect(data[0].name).to.equal('video_short.webm name')
      expect(data[1].name).to.equal('video_short.ogv name')
      expect(data[2].name).to.equal('video_short.mp4 name')
      expect(data[3].name).to.equal('video_short3.webm name')
      expect(data[4].name).to.equal('video_short2.webm name')
      expect(data[5].name).to.equal('video_short1.webm name')

      videoId = data[3].uuid
      videoId2 = data[5].uuid
    })

    it('Should list and sort by trending in descending order', async function () {
      const { total, data } = await server.videos.list({ start: 0, count: 2, sort: '-trending' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(2)
    })

    it('Should list and sort by hotness in descending order', async function () {
      const { total, data } = await server.videos.list({ start: 0, count: 2, sort: '-hot' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(2)
    })

    it('Should list and sort by best in descending order', async function () {
      const { total, data } = await server.videos.list({ start: 0, count: 2, sort: '-best' })

      expect(total).to.equal(6)
      expect(data.length).to.equal(2)
    })

    it('Should update a video', async function () {
      const attributes = {
        name: 'my super video updated',
        category: 4,
        licence: 2,
        language: 'ar',
        nsfw: false,
        description: 'my super description updated',
        commentsPolicy: VideoCommentPolicy.DISABLED,
        downloadEnabled: false,
        tags: [ 'tagup1', 'tagup2' ]
      }
      await server.videos.update({ id: videoId, attributes })
    })

    it('Should have the video updated', async function () {
      this.timeout(60000)

      await waitJobs([ server ])

      const video = await server.videos.get({ id: videoId })

      await completeVideoCheck({ server, originServer: server, videoUUID: video.uuid, attributes: updateCheckAttributes() })
    })

    it('Should update only the tags of a video', async function () {
      const attributes = {
        tags: [ 'supertag', 'tag1', 'tag2' ]
      }
      await server.videos.update({ id: videoId, attributes })

      const video = await server.videos.get({ id: videoId })

      await completeVideoCheck({
        server,
        originServer: server,
        videoUUID: video.uuid,
        attributes: Object.assign(updateCheckAttributes(), attributes)
      })
    })

    it('Should update only the description of a video', async function () {
      const attributes = {
        description: 'hello everybody'
      }
      await server.videos.update({ id: videoId, attributes })

      const video = await server.videos.get({ id: videoId })

      await completeVideoCheck({
        server,
        originServer: server,
        videoUUID: video.uuid,
        attributes: Object.assign(updateCheckAttributes(), { tags: [ 'supertag', 'tag1', 'tag2' ] }, attributes)
      })
    })

    it('Should like a video', async function () {
      await server.videos.rate({ id: videoId, rating: 'like' })

      const video = await server.videos.get({ id: videoId })

      expect(video.likes).to.equal(1)
      expect(video.dislikes).to.equal(0)
    })

    it('Should dislike the same video', async function () {
      await server.videos.rate({ id: videoId, rating: 'dislike' })

      const video = await server.videos.get({ id: videoId })

      expect(video.likes).to.equal(0)
      expect(video.dislikes).to.equal(1)
    })

    it('Should sort by originallyPublishedAt', async function () {
      {
        const now = new Date()
        const attributes = { originallyPublishedAt: now.toISOString() }
        await server.videos.update({ id: videoId, attributes })

        const { data } = await server.videos.list({ sort: '-originallyPublishedAt' })
        const names = data.map(v => v.name)

        expect(names[0]).to.equal('my super video updated')
        expect(names[1]).to.equal('video_short2.webm name')
        expect(names[2]).to.equal('video_short1.webm name')
        expect(names[3]).to.equal('video_short.webm name')
        expect(names[4]).to.equal('video_short.ogv name')
        expect(names[5]).to.equal('video_short.mp4 name')
      }

      {
        const now = new Date()
        const attributes = { originallyPublishedAt: now.toISOString() }
        await server.videos.update({ id: videoId2, attributes })

        const { data } = await server.videos.list({ sort: '-originallyPublishedAt' })
        const names = data.map(v => v.name)

        expect(names[0]).to.equal('video_short1.webm name')
        expect(names[1]).to.equal('my super video updated')
        expect(names[2]).to.equal('video_short2.webm name')
        expect(names[3]).to.equal('video_short.webm name')
        expect(names[4]).to.equal('video_short.ogv name')
        expect(names[5]).to.equal('video_short.mp4 name')
      }
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  }

  describe('Legacy upload', function () {
    runSuite('legacy')
  })

  describe('Resumable upload', function () {
    runSuite('resumable')
  })
})
