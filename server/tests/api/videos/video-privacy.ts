/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import {
  cleanupTests,
  flushAndRunServer,
  getVideosList,
  getVideosListWithToken,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../../../shared/extra-utils/index'
import { doubleFollow } from '../../../../shared/extra-utils/server/follows'
import { userLogin } from '../../../../shared/extra-utils/users/login'
import { createUser } from '../../../../shared/extra-utils/users/users'
import { getMyVideos, getVideo, getVideoWithToken, updateVideo } from '../../../../shared/extra-utils/videos/videos'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { Video } from '@shared/models'

const expect = chai.expect

describe('Test video privacy', function () {
  const servers: ServerInfo[] = []
  let anotherUserToken: string

  let privateVideoId: number
  let privateVideoUUID: string

  let internalVideoId: number
  let internalVideoUUID: string

  let unlistedVideoUUID: string
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
    servers.push(await flushAndRunServer(1, dontFederateUnlistedConfig))
    servers.push(await flushAndRunServer(2))

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload a private and internal videos on server 1', async function () {
    this.timeout(10000)

    for (const privacy of [ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]) {
      const attributes = { privacy }
      await uploadVideo(servers[0].url, servers[0].accessToken, attributes)
    }

    await waitJobs(servers)
  })

  it('Should not have these private and internal videos on server 2', async function () {
    const res = await getVideosList(servers[1].url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should not list the private and internal videos for an unauthenticated user on server 1', async function () {
    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should not list the private video and list the internal video for an authenticated user on server 1', async function () {
    const res = await getVideosListWithToken(servers[0].url, servers[0].accessToken)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    expect(res.body.data[0].privacy.id).to.equal(VideoPrivacy.INTERNAL)
  })

  it('Should list my (private and internal) videos', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 10)

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.have.lengthOf(2)

    const videos: Video[] = res.body.data

    const privateVideo = videos.find(v => v.privacy.id === VideoPrivacy.PRIVATE)
    privateVideoId = privateVideo.id
    privateVideoUUID = privateVideo.uuid

    const internalVideo = videos.find(v => v.privacy.id === VideoPrivacy.INTERNAL)
    internalVideoId = internalVideo.id
    internalVideoUUID = internalVideo.uuid
  })

  it('Should not be able to watch the private/internal video with non authenticated user', async function () {
    await getVideo(servers[0].url, privateVideoUUID, 401)
    await getVideo(servers[0].url, internalVideoUUID, 401)
  })

  it('Should not be able to watch the private video with another user', async function () {
    this.timeout(10000)

    const user = {
      username: 'hello',
      password: 'super password'
    }
    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

    anotherUserToken = await userLogin(servers[0], user)
    await getVideoWithToken(servers[0].url, anotherUserToken, privateVideoUUID, 403)
  })

  it('Should be able to watch the internal video with another user', async function () {
    await getVideoWithToken(servers[0].url, anotherUserToken, internalVideoUUID, 200)
  })

  it('Should be able to watch the private video with the correct user', async function () {
    await getVideoWithToken(servers[0].url, servers[0].accessToken, privateVideoUUID, 200)
  })

  it('Should upload an unlisted video on server 2', async function () {
    this.timeout(30000)

    const attributes = {
      name: 'unlisted video',
      privacy: VideoPrivacy.UNLISTED
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, attributes)

    // Server 2 has transcoding enabled
    await waitJobs(servers)
  })

  it('Should not have this unlisted video listed on server 1 and 2', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should list my (unlisted) videos', async function () {
    const res = await getMyVideos(servers[1].url, servers[1].accessToken, 0, 1)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    unlistedVideoUUID = res.body.data[0].uuid
  })

  it('Should be able to get this unlisted video', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, unlistedVideoUUID)

      expect(res.body.name).to.equal('unlisted video')
    }
  })

  it('Should upload a non-federating unlisted video to server 1', async function () {
    this.timeout(30000)

    const attributes = {
      name: 'unlisted video',
      privacy: VideoPrivacy.UNLISTED
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, attributes)

    await waitJobs(servers)
  })

  it('Should list my new unlisted video', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 3)

    expect(res.body.total).to.equal(3)
    expect(res.body.data).to.have.lengthOf(3)

    nonFederatedUnlistedVideoUUID = res.body.data[0].uuid
  })

  it('Should be able to get non-federated unlisted video from origin', async function () {
    const res = await getVideo(servers[0].url, nonFederatedUnlistedVideoUUID)

    expect(res.body.name).to.equal('unlisted video')
  })

  it('Should not be able to get non-federated unlisted video from federated server', async function () {
    await getVideo(servers[1].url, nonFederatedUnlistedVideoUUID, 404)
  })

  it('Should update the private and internal videos to public on server 1', async function () {
    this.timeout(10000)

    now = Date.now()

    {
      const attribute = {
        name: 'private video becomes public',
        privacy: VideoPrivacy.PUBLIC
      }

      await updateVideo(servers[0].url, servers[0].accessToken, privateVideoId, attribute)
    }

    {
      const attribute = {
        name: 'internal video becomes public',
        privacy: VideoPrivacy.PUBLIC
      }
      await updateVideo(servers[0].url, servers[0].accessToken, internalVideoId, attribute)
    }

    await waitJobs(servers)
  })

  it('Should have this new public video listed on server 1 and 2', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      const videos: Video[] = res.body.data
      const privateVideo = videos.find(v => v.name === 'private video becomes public')
      const internalVideo = videos.find(v => v.name === 'internal video becomes public')

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
    this.timeout(10000)

    await updateVideo(servers[0].url, servers[0].accessToken, internalVideoId, { privacy: VideoPrivacy.PRIVATE })
    await updateVideo(servers[0].url, servers[0].accessToken, privateVideoId, { privacy: VideoPrivacy.INTERNAL })

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 5)
      const videos = res.body.data

      expect(res.body.total).to.equal(3)
      expect(videos).to.have.lengthOf(3)

      const privateVideo = videos.find(v => v.name === 'private video becomes public')
      const internalVideo = videos.find(v => v.name === 'internal video becomes public')

      expect(privateVideo).to.not.be.undefined
      expect(internalVideo).to.not.be.undefined

      expect(privateVideo.privacy.id).to.equal(VideoPrivacy.INTERNAL)
      expect(internalVideo.privacy.id).to.equal(VideoPrivacy.PRIVATE)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
