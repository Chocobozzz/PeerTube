/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { User, Video } from '../../../../shared/index'
import { doubleFollow, flushAndRunMultipleServers, getVideoChannelVideos, updateVideo, uploadVideo, wait } from '../../utils'
import {
  addVideoChannel,
  deleteVideoChannel,
  flushTests,
  getAccountVideoChannelsList,
  getMyUserInformation,
  getVideoChannel,
  getVideoChannelsList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoChannel
} from '../../utils/index'
import { getAccountsList } from '../../utils/users/accounts'

const expect = chai.expect

describe('Test video channels', function () {
  let servers: ServerInfo[]
  let userInfo: User
  let accountUUID: string
  let firstVideoChannelId: number
  let firstVideoChannelUUID: string
  let secondVideoChannelId: number
  let secondVideoChannelUUID: string
  let videoUUID: string

  before(async function () {
    this.timeout(30000)

    await flushTests()

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    {
      const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
      const user: User = res.body
      accountUUID = user.account.uuid

      firstVideoChannelId = user.videoChannels[0].id
      firstVideoChannelUUID = user.videoChannels[0].uuid
    }

    await wait(5000)
  })

  it('Should have one video channel (created with root)', async () => {
    const res = await getVideoChannelsList(servers[0].url, 0, 2)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
  })

  it('Should create another video channel', async function () {
    this.timeout(10000)

    {
      const videoChannel = {
        displayName: 'second video channel',
        description: 'super video channel description',
        support: 'super video channel support text'
      }
      const res = await addVideoChannel(servers[ 0 ].url, servers[ 0 ].accessToken, videoChannel)
      secondVideoChannelId = res.body.videoChannel.id
      secondVideoChannelUUID = res.body.videoChannel.uuid
    }

    // The channel is 1 is propagated to servers 2
    {
      const res = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, { name: 'my video name', channelId: secondVideoChannelId })
      videoUUID = res.body.video.uuid
    }

    await wait(3000)
  })

  it('Should have two video channels when getting my information', async () => {
    const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
    userInfo = res.body

    expect(userInfo.videoChannels).to.be.an('array')
    expect(userInfo.videoChannels).to.have.lengthOf(2)

    const videoChannels = userInfo.videoChannels
    expect(videoChannels[0].displayName).to.equal('Default root channel')
    expect(videoChannels[1].displayName).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
    expect(videoChannels[1].support).to.equal('super video channel support text')
  })

  it('Should have two video channels when getting account channels on server 1', async function () {
    const res = await getAccountVideoChannelsList(servers[0].url, userInfo.account.uuid)
    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(2)

    const videoChannels = res.body.data
    expect(videoChannels[0].displayName).to.equal('Default root channel')
    expect(videoChannels[1].displayName).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
    expect(videoChannels[1].support).to.equal('super video channel support text')
  })

  it('Should have one video channel when getting account channels on server 2', async function () {
    const res = await getAccountVideoChannelsList(servers[1].url, userInfo.account.uuid)
    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)

    const videoChannels = res.body.data
    expect(videoChannels[0].displayName).to.equal('second video channel')
    expect(videoChannels[0].description).to.equal('super video channel description')
    expect(videoChannels[0].support).to.equal('super video channel support text')
  })

  it('Should list video channels', async function () {
    const res = await getVideoChannelsList(servers[0].url, 1, 1, '-name')

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].displayName).to.equal('Default root channel')
  })

  it('Should update video channel', async function () {
    this.timeout(5000)

    const videoChannelAttributes = {
      displayName: 'video channel updated',
      description: 'video channel description updated',
      support: 'video channel support text updated'
    }

    await updateVideoChannel(servers[0].url, servers[0].accessToken, secondVideoChannelId, videoChannelAttributes)

    await wait(3000)
  })

  it('Should have video channel updated', async function () {
    for (const server of servers) {
      const res = await getVideoChannelsList(server.url, 0, 1, '-name')

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].displayName).to.equal('video channel updated')
      expect(res.body.data[0].description).to.equal('video channel description updated')
      expect(res.body.data[0].support).to.equal('video channel support text updated')
    }
  })

  it('Should get video channel', async function () {
    const res = await getVideoChannel(servers[0].url, secondVideoChannelId)

    const videoChannel = res.body
    expect(videoChannel.displayName).to.equal('video channel updated')
    expect(videoChannel.description).to.equal('video channel description updated')
    expect(videoChannel.support).to.equal('video channel support text updated')
  })

  it('Should list the second video channel videos', async function () {
    this.timeout(10000)

    for (const server of servers) {
      const res1 = await getVideoChannelVideos(server.url, server.accessToken, secondVideoChannelUUID, 0, 5)
      expect(res1.body.total).to.equal(1)
      expect(res1.body.data).to.be.an('array')
      expect(res1.body.data).to.have.lengthOf(1)
      expect(res1.body.data[0].name).to.equal('my video name')
    }
  })

  it('Should change the video channel of a video', async function () {
    this.timeout(10000)

    await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { channelId: firstVideoChannelId })

    await wait(5000)
  })

  it('Should list the first video channel videos', async function () {
    this.timeout(10000)

    for (const server of servers) {
      const res1 = await getVideoChannelVideos(server.url, server.accessToken, secondVideoChannelUUID, 0, 5)
      expect(res1.body.total).to.equal(0)

      const res2 = await getVideoChannelVideos(server.url, server.accessToken, firstVideoChannelUUID, 0, 5)
      expect(res2.body.total).to.equal(1)

      const videos: Video[] = res2.body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(1)
      expect(videos[0].name).to.equal('my video name')
    }
  })

  it('Should delete video channel', async function () {
    await deleteVideoChannel(servers[0].url, servers[0].accessToken, secondVideoChannelId)
  })

  it('Should have video channel deleted', async function () {
    const res = await getVideoChannelsList(servers[0].url, 0, 10)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].displayName).to.equal('Default root channel')
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
