/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video privacy', function () {
  const servers: PeerTubeServer[] = []
  let anotherUserToken: string

  let privateVideoId: number
  let privateVideoUUID: string

  let internalVideoId: number
  let internalVideoUUID: string

  let unlistedVideo: VideoCreateResult
  let nonFederatedUnlistedVideoUUID: string

  let now: number

  const dontFederateUnlistedConfig = {
    federation: {
      videos: {
        federate_unlisted: false
      }
    }
  }

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers.push(await createSingleServer(1, dontFederateUnlistedConfig))
    servers.push(await createSingleServer(2))

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Private and internal videos', function () {

    it('Should upload a private and internal videos on server 1', async function () {
      this.timeout(50000)

      for (const privacy of [ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]) {
        const attributes = { privacy }
        await servers[0].videos.upload({ attributes })
      }

      await waitJobs(servers)
    })

    it('Should not have these private and internal videos on server 2', async function () {
      const { total, data } = await servers[1].videos.list()

      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    })

    it('Should not list the private and internal videos for an unauthenticated user on server 1', async function () {
      const { total, data } = await servers[0].videos.list()

      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    })

    it('Should not list the private video and list the internal video for an authenticated user on server 1', async function () {
      const { total, data } = await servers[0].videos.listWithToken()

      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      expect(data[0].privacy.id).to.equal(VideoPrivacy.INTERNAL)
    })

    it('Should list my (private and internal) videos', async function () {
      const { total, data } = await servers[0].videos.listMyVideos()

      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      const privateVideo = data.find(v => v.privacy.id === VideoPrivacy.PRIVATE)
      privateVideoId = privateVideo.id
      privateVideoUUID = privateVideo.uuid

      const internalVideo = data.find(v => v.privacy.id === VideoPrivacy.INTERNAL)
      internalVideoId = internalVideo.id
      internalVideoUUID = internalVideo.uuid
    })

    it('Should not be able to watch the private/internal video with non authenticated user', async function () {
      await servers[0].videos.get({ id: privateVideoUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await servers[0].videos.get({ id: internalVideoUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to watch the private video with another user', async function () {
      const user = {
        username: 'hello',
        password: 'super password'
      }
      await servers[0].users.create({ username: user.username, password: user.password })

      anotherUserToken = await servers[0].login.getAccessToken(user)

      await servers[0].videos.getWithToken({
        token: anotherUserToken,
        id: privateVideoUUID,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should be able to watch the internal video with another user', async function () {
      await servers[0].videos.getWithToken({ token: anotherUserToken, id: internalVideoUUID })
    })

    it('Should be able to watch the private video with the correct user', async function () {
      await servers[0].videos.getWithToken({ id: privateVideoUUID })
    })
  })

  describe('Unlisted videos', function () {

    it('Should upload an unlisted video on server 2', async function () {
      this.timeout(120000)

      const attributes = {
        name: 'unlisted video',
        privacy: VideoPrivacy.UNLISTED
      }
      await servers[1].videos.upload({ attributes })

      // Server 2 has transcoding enabled
      await waitJobs(servers)
    })

    it('Should not have this unlisted video listed on server 1 and 2', async function () {
      for (const server of servers) {
        const { total, data } = await server.videos.list()

        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }
    })

    it('Should list my (unlisted) videos', async function () {
      const { total, data } = await servers[1].videos.listMyVideos()

      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      unlistedVideo = data[0]
    })

    it('Should not be able to get this unlisted video using its id', async function () {
      await servers[1].videos.get({ id: unlistedVideo.id, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should be able to get this unlisted video using its uuid/shortUUID', async function () {
      for (const server of servers) {
        for (const id of [ unlistedVideo.uuid, unlistedVideo.shortUUID ]) {
          const video = await server.videos.get({ id })

          expect(video.name).to.equal('unlisted video')
        }
      }
    })

    it('Should upload a non-federating unlisted video to server 1', async function () {
      this.timeout(30000)

      const attributes = {
        name: 'unlisted video',
        privacy: VideoPrivacy.UNLISTED
      }
      await servers[0].videos.upload({ attributes })

      await waitJobs(servers)
    })

    it('Should list my new unlisted video', async function () {
      const { total, data } = await servers[0].videos.listMyVideos()

      expect(total).to.equal(3)
      expect(data).to.have.lengthOf(3)

      nonFederatedUnlistedVideoUUID = data[0].uuid
    })

    it('Should be able to get non-federated unlisted video from origin', async function () {
      const video = await servers[0].videos.get({ id: nonFederatedUnlistedVideoUUID })

      expect(video.name).to.equal('unlisted video')
    })

    it('Should not be able to get non-federated unlisted video from federated server', async function () {
      await servers[1].videos.get({ id: nonFederatedUnlistedVideoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  describe('Privacy update', function () {

    it('Should update the private and internal videos to public on server 1', async function () {
      this.timeout(100000)

      now = Date.now()

      {
        const attributes = {
          name: 'private video becomes public',
          privacy: VideoPrivacy.PUBLIC
        }

        await servers[0].videos.update({ id: privateVideoId, attributes })
      }

      {
        const attributes = {
          name: 'internal video becomes public',
          privacy: VideoPrivacy.PUBLIC
        }
        await servers[0].videos.update({ id: internalVideoId, attributes })
      }

      await wait(10000)
      await waitJobs(servers)
    })

    it('Should have this new public video listed on server 1 and 2', async function () {
      for (const server of servers) {
        const { total, data } = await server.videos.list()
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        const privateVideo = data.find(v => v.name === 'private video becomes public')
        const internalVideo = data.find(v => v.name === 'internal video becomes public')

        expect(privateVideo).to.not.be.undefined
        expect(internalVideo).to.not.be.undefined

        expect(new Date(privateVideo.publishedAt).getTime()).to.be.at.least(now)
        // We don't change the publish date of internal videos
        expect(new Date(internalVideo.publishedAt).getTime()).to.be.below(now)

        expect(privateVideo.privacy.id).to.equal(VideoPrivacy.PUBLIC)
        expect(internalVideo.privacy.id).to.equal(VideoPrivacy.PUBLIC)
      }
    })

    it('Should set these videos as private and internal', async function () {
      await servers[0].videos.update({ id: internalVideoId, attributes: { privacy: VideoPrivacy.PRIVATE } })
      await servers[0].videos.update({ id: privateVideoId, attributes: { privacy: VideoPrivacy.INTERNAL } })

      await waitJobs(servers)

      for (const server of servers) {
        const { total, data } = await server.videos.list()

        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }

      {
        const { total, data } = await servers[0].videos.listMyVideos()
        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(3)

        const privateVideo = data.find(v => v.name === 'private video becomes public')
        const internalVideo = data.find(v => v.name === 'internal video becomes public')

        expect(privateVideo).to.not.be.undefined
        expect(internalVideo).to.not.be.undefined

        expect(privateVideo.privacy.id).to.equal(VideoPrivacy.INTERNAL)
        expect(internalVideo.privacy.id).to.equal(VideoPrivacy.PRIVATE)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
