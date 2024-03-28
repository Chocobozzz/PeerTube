/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test user videos', function () {
  let server: PeerTubeServer
  let videoId: number
  let videoId2: number
  let token: string
  let anotherUserToken: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultChannelAvatar([ server ])
    await setDefaultAccountAvatar([ server ])

    await server.videos.quickUpload({ name: 'root video' })
    await server.videos.quickUpload({ name: 'root video 2' })

    token = await server.users.generateUserAndToken('user')
    anotherUserToken = await server.users.generateUserAndToken('user2')
  })

  describe('List my videos', function () {

    it('Should list my videos', async function () {
      const { data, total } = await server.videos.listMyVideos()

      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)
    })
  })

  describe('Upload', function () {

    it('Should upload the video with the correct token', async function () {
      await server.videos.upload({ token })
      const { data } = await server.videos.list()
      const video = data[0]

      expect(video.account.name).to.equal('user')
      videoId = video.id
    })

    it('Should upload the video again with the correct token', async function () {
      const { id } = await server.videos.upload({ token })
      videoId2 = id
    })
  })

  describe('Ratings', function () {

    it('Should retrieve a video rating', async function () {
      await server.videos.rate({ id: videoId, token, rating: 'like' })
      const rating = await server.users.getMyRating({ token, videoId })

      expect(rating.videoId).to.equal(videoId)
      expect(rating.rating).to.equal('like')
    })

    it('Should retrieve ratings list', async function () {
      await server.videos.rate({ id: videoId, token, rating: 'like' })

      const body = await server.accounts.listRatings({ accountName: 'user', token })

      expect(body.total).to.equal(1)
      expect(body.data[0].video.id).to.equal(videoId)
      expect(body.data[0].rating).to.equal('like')
    })

    it('Should retrieve ratings list by rating type', async function () {
      {
        const body = await server.accounts.listRatings({ accountName: 'user', token, rating: 'like' })
        expect(body.data.length).to.equal(1)
      }

      {
        const body = await server.accounts.listRatings({ accountName: 'user', token, rating: 'dislike' })
        expect(body.data.length).to.equal(0)
      }
    })
  })

  describe('Remove video', function () {

    it('Should not be able to remove the video with an incorrect token', async function () {
      await server.videos.remove({ token: 'bad_token', id: videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to remove the video with the token of another account', async function () {
      await server.videos.remove({ token: anotherUserToken, id: videoId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should be able to remove the video with the correct token', async function () {
      await server.videos.remove({ token, id: videoId })
      await server.videos.remove({ token, id: videoId2 })
    })
  })

  describe('My videos & quotas', function () {

    it('Should be able to upload a video with a user', async function () {
      this.timeout(30000)

      const attributes = {
        name: 'super user video',
        fixture: 'video_short.webm'
      }
      await server.videos.upload({ token, attributes })

      await server.channels.create({ token, attributes: { name: 'other_channel' } })
    })

    it('Should have video quota updated', async function () {
      const quota = await server.users.getMyQuotaUsed({ token })
      expect(quota.videoQuotaUsed).to.equal(218910)
      expect(quota.videoQuotaUsedDaily).to.equal(218910)

      const { data } = await server.users.list()
      const tmpUser = data.find(u => u.username === 'user')
      expect(tmpUser.videoQuotaUsed).to.equal(218910)
      expect(tmpUser.videoQuotaUsedDaily).to.equal(218910)
    })

    it('Should be able to list my videos', async function () {
      const { total, data } = await server.videos.listMyVideos({ token })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      const video = data[0]
      expect(video.name).to.equal('super user video')
      expect(video.thumbnailPath).to.not.be.null
      expect(video.previewPath).to.not.be.null
    })

    it('Should be able to filter by channel in my videos', async function () {
      const myInfo = await server.users.getMyInfo({ token })
      const mainChannel = myInfo.videoChannels.find(c => c.name !== 'other_channel')
      const otherChannel = myInfo.videoChannels.find(c => c.name === 'other_channel')

      {
        const { total, data } = await server.videos.listMyVideos({ token, channelId: mainChannel.id })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)

        const video = data[0]
        expect(video.name).to.equal('super user video')
        expect(video.thumbnailPath).to.not.be.null
        expect(video.previewPath).to.not.be.null
      }

      {
        const { total, data } = await server.videos.listMyVideos({ token, channelId: otherChannel.id })
        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }
    })

    it('Should be able to search in my videos', async function () {
      {
        const { total, data } = await server.videos.listMyVideos({ token, sort: '-createdAt', search: 'user video' })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      }

      {
        const { total, data } = await server.videos.listMyVideos({ token, sort: '-createdAt', search: 'toto' })
        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }
    })

    it('Should disable web videos, enable HLS, and update my quota', async function () {
      this.timeout(160000)

      {
        const config = await server.config.getCustomConfig()
        config.transcoding.webVideos.enabled = false
        config.transcoding.hls.enabled = true
        config.transcoding.enabled = true
        await server.config.updateExistingConfig({ newConfig: config })
      }

      {
        const attributes = {
          name: 'super user video 2',
          fixture: 'video_short.webm'
        }
        await server.videos.upload({ token, attributes })

        await waitJobs([ server ])
      }

      {
        const data = await server.users.getMyQuotaUsed({ token })
        expect(data.videoQuotaUsed).to.be.greaterThan(220000)
        expect(data.videoQuotaUsedDaily).to.be.greaterThan(220000)
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
