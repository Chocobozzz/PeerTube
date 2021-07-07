/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  acceptChangeOwnership,
  changeVideoOwnership,
  cleanupTests,
  createLive,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushAndRunServer,
  getMyUserInformation,
  getVideo,
  getVideoChangeOwnershipList,
  getVideosList,
  refuseChangeOwnership,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateCustomSubConfig,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { User } from '../../../../shared/models/users'
import { VideoDetails, VideoPrivacy } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test video change ownership - nominal', function () {
  let servers: ServerInfo[] = []
  const firstUser = {
    username: 'first',
    password: 'My great password'
  }
  const secondUser = {
    username: 'second',
    password: 'My other password'
  }

  let firstUserAccessToken = ''
  let firstUserChannelId: number

  let secondUserAccessToken = ''
  let secondUserChannelId: number

  let lastRequestChangeOwnershipId = ''

  let liveId: number

  before(async function () {
    this.timeout(50000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      transcoding: {
        enabled: false
      },
      live: {
        enabled: true
      }
    })

    const videoQuota = 42000000
    await createUser({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      username: firstUser.username,
      password: firstUser.password,
      videoQuota: videoQuota
    })
    await createUser({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      username: secondUser.username,
      password: secondUser.password,
      videoQuota: videoQuota
    })

    firstUserAccessToken = await userLogin(servers[0], firstUser)
    secondUserAccessToken = await userLogin(servers[0], secondUser)

    {
      const res = await getMyUserInformation(servers[0].url, firstUserAccessToken)
      const firstUserInformation: User = res.body
      firstUserChannelId = firstUserInformation.videoChannels[0].id
    }

    {
      const res = await getMyUserInformation(servers[0].url, secondUserAccessToken)
      const secondUserInformation: User = res.body
      secondUserChannelId = secondUserInformation.videoChannels[0].id
    }

    {
      const videoAttributes = {
        name: 'my super name',
        description: 'my super description'
      }
      const res = await uploadVideo(servers[0].url, firstUserAccessToken, videoAttributes)

      const resVideo = await getVideo(servers[0].url, res.body.video.id)
      servers[0].video = resVideo.body
    }

    {
      const attributes = { name: 'live', channelId: firstUserChannelId, privacy: VideoPrivacy.PUBLIC }
      const res = await createLive(servers[0].url, firstUserAccessToken, attributes)

      liveId = res.body.video.id
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should not have video change ownership', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(servers[0].url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(0)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(0)
  })

  it('Should send a request to change ownership of a video', async function () {
    this.timeout(15000)

    await changeVideoOwnership(servers[0].url, firstUserAccessToken, servers[0].video.id, secondUser.username)
  })

  it('Should only return a request to change ownership for the second user', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(servers[0].url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(1)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(1)

    lastRequestChangeOwnershipId = resSecondUser.body.data[0].id
  })

  it('Should accept the same change ownership request without crashing', async function () {
    this.timeout(10000)

    await changeVideoOwnership(servers[0].url, firstUserAccessToken, servers[0].video.id, secondUser.username)
  })

  it('Should not create multiple change ownership requests while one is waiting', async function () {
    this.timeout(10000)

    const resSecondUser = await getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(1)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(1)
  })

  it('Should not be possible to refuse the change of ownership from first user', async function () {
    this.timeout(10000)

    await refuseChangeOwnership(servers[0].url, firstUserAccessToken, lastRequestChangeOwnershipId, HttpStatusCode.FORBIDDEN_403)
  })

  it('Should be possible to refuse the change of ownership from second user', async function () {
    this.timeout(10000)

    await refuseChangeOwnership(servers[0].url, secondUserAccessToken, lastRequestChangeOwnershipId)
  })

  it('Should send a new request to change ownership of a video', async function () {
    this.timeout(15000)

    await changeVideoOwnership(servers[0].url, firstUserAccessToken, servers[0].video.id, secondUser.username)
  })

  it('Should return two requests to change ownership for the second user', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(servers[0].url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(2)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(2)

    lastRequestChangeOwnershipId = resSecondUser.body.data[0].id
  })

  it('Should not be possible to accept the change of ownership from first user', async function () {
    this.timeout(10000)

    await acceptChangeOwnership(
      servers[0].url,
      firstUserAccessToken,
      lastRequestChangeOwnershipId,
      secondUserChannelId,
      HttpStatusCode.FORBIDDEN_403
    )
  })

  it('Should be possible to accept the change of ownership from second user', async function () {
    this.timeout(10000)

    await acceptChangeOwnership(servers[0].url, secondUserAccessToken, lastRequestChangeOwnershipId, secondUserChannelId)

    await waitJobs(servers)
  })

  it('Should have the channel of the video updated', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, servers[0].video.uuid)

      const video: VideoDetails = res.body

      expect(video.name).to.equal('my super name')
      expect(video.channel.displayName).to.equal('Main second channel')
      expect(video.channel.name).to.equal('second_channel')
    }
  })

  it('Should send a request to change ownership of a live', async function () {
    this.timeout(15000)

    await changeVideoOwnership(servers[0].url, firstUserAccessToken, liveId, secondUser.username)

    const resSecondUser = await getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(3)
    expect(resSecondUser.body.data.length).to.equal(3)

    lastRequestChangeOwnershipId = resSecondUser.body.data[0].id
  })

  it('Should accept a live ownership change', async function () {
    this.timeout(20000)

    await acceptChangeOwnership(servers[0].url, secondUserAccessToken, lastRequestChangeOwnershipId, secondUserChannelId)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, servers[0].video.uuid)

      const video: VideoDetails = res.body

      expect(video.name).to.equal('my super name')
      expect(video.channel.displayName).to.equal('Main second channel')
      expect(video.channel.name).to.equal('second_channel')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})

describe('Test video change ownership - quota too small', function () {
  let server: ServerInfo
  const firstUser = {
    username: 'first',
    password: 'My great password'
  }
  const secondUser = {
    username: 'second',
    password: 'My other password'
  }
  let firstUserAccessToken = ''
  let secondUserAccessToken = ''
  let lastRequestChangeOwnershipId = ''

  before(async function () {
    this.timeout(50000)

    // Run one server
    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    const videoQuota = 42000000
    const limitedVideoQuota = 10
    await createUser({
      url: server.url,
      accessToken: server.accessToken,
      username: firstUser.username,
      password: firstUser.password,
      videoQuota: videoQuota
    })
    await createUser({
      url: server.url,
      accessToken: server.accessToken,
      username: secondUser.username,
      password: secondUser.password,
      videoQuota: limitedVideoQuota
    })

    firstUserAccessToken = await userLogin(server, firstUser)
    secondUserAccessToken = await userLogin(server, secondUser)

    // Upload some videos on the server
    const video1Attributes = {
      name: 'my super name',
      description: 'my super description'
    }
    await uploadVideo(server.url, firstUserAccessToken, video1Attributes)

    await waitJobs(server)

    const res = await getVideosList(server.url)
    const videos = res.body.data

    expect(videos.length).to.equal(1)

    server.video = videos.find(video => video.name === 'my super name')
  })

  it('Should send a request to change ownership of a video', async function () {
    this.timeout(15000)

    await changeVideoOwnership(server.url, firstUserAccessToken, server.video.id, secondUser.username)
  })

  it('Should only return a request to change ownership for the second user', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(server.url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(server.url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(1)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(1)

    lastRequestChangeOwnershipId = resSecondUser.body.data[0].id
  })

  it('Should not be possible to accept the change of ownership from second user because of exceeded quota', async function () {
    this.timeout(10000)

    const secondUserInformationResponse = await getMyUserInformation(server.url, secondUserAccessToken)
    const secondUserInformation: User = secondUserInformationResponse.body
    const channelId = secondUserInformation.videoChannels[0].id

    await acceptChangeOwnership(
      server.url,
      secondUserAccessToken,
      lastRequestChangeOwnershipId,
      channelId,
      HttpStatusCode.PAYLOAD_TOO_LARGE_413
    )
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
