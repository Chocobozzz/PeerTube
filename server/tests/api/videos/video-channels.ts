/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideo,
  getVideoChannelVideos,
  testImage,
  updateVideo,
  updateVideoChannelAvatar,
  uploadVideo,
  userLogin,
  wait
} from '../../../../shared/extra-utils'
import {
  addVideoChannel,
  deleteVideoChannel,
  getAccountVideoChannelsList,
  getMyUserInformation,
  getVideoChannel,
  getVideoChannelsList,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoChannel,
  viewVideo
} from '../../../../shared/extra-utils/index'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { User, Video, VideoChannel, VideoDetails } from '../../../../shared/index'

const expect = chai.expect

describe('Test video channels', function () {
  let servers: ServerInfo[]
  let userInfo: User
  let firstVideoChannelId: number
  let secondVideoChannelId: number
  let videoUUID: string

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    {
      const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
      const user: User = res.body

      firstVideoChannelId = user.videoChannels[0].id
    }

    await waitJobs(servers)
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
        name: 'second_video_channel',
        displayName: 'second video channel',
        description: 'super video channel description',
        support: 'super video channel support text'
      }
      const res = await addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel)
      secondVideoChannelId = res.body.videoChannel.id
    }

    // The channel is 1 is propagated to servers 2
    {
      const videoAttributesArg = { name: 'my video name', channelId: secondVideoChannelId, support: 'video support field' }
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributesArg)
      videoUUID = res.body.video.uuid
    }

    await waitJobs(servers)
  })

  it('Should have two video channels when getting my information', async () => {
    const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
    userInfo = res.body

    expect(userInfo.videoChannels).to.be.an('array')
    expect(userInfo.videoChannels).to.have.lengthOf(2)

    const videoChannels = userInfo.videoChannels
    expect(videoChannels[0].name).to.equal('root_channel')
    expect(videoChannels[0].displayName).to.equal('Main root channel')

    expect(videoChannels[1].name).to.equal('second_video_channel')
    expect(videoChannels[1].displayName).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
    expect(videoChannels[1].support).to.equal('super video channel support text')
  })

  it('Should have two video channels when getting account channels on server 1', async function () {
    const res = await getAccountVideoChannelsList({
      url: servers[0].url,
      accountName: userInfo.account.name + '@' + userInfo.account.host
    })

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(2)

    const videoChannels = res.body.data
    expect(videoChannels[0].name).to.equal('root_channel')
    expect(videoChannels[0].displayName).to.equal('Main root channel')

    expect(videoChannels[1].name).to.equal('second_video_channel')
    expect(videoChannels[1].displayName).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
    expect(videoChannels[1].support).to.equal('super video channel support text')
  })

  it('Should paginate and sort account channels', async function () {
    {
      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        start: 0,
        count: 1,
        sort: 'createdAt'
      })

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(1)

      const videoChannel: VideoChannel = res.body.data[0]
      expect(videoChannel.name).to.equal('root_channel')
    }

    {
      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        start: 0,
        count: 1,
        sort: '-createdAt'
      })

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(1)

      const videoChannel: VideoChannel = res.body.data[0]
      expect(videoChannel.name).to.equal('second_video_channel')
    }

    {
      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        start: 1,
        count: 1,
        sort: '-createdAt'
      })

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(1)

      const videoChannel: VideoChannel = res.body.data[0]
      expect(videoChannel.name).to.equal('root_channel')
    }
  })

  it('Should have one video channel when getting account channels on server 2', async function () {
    const res = await getAccountVideoChannelsList({
      url: servers[1].url,
      accountName: userInfo.account.name + '@' + userInfo.account.host
    })

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)

    const videoChannels = res.body.data
    expect(videoChannels[0].name).to.equal('second_video_channel')
    expect(videoChannels[0].displayName).to.equal('second video channel')
    expect(videoChannels[0].description).to.equal('super video channel description')
    expect(videoChannels[0].support).to.equal('super video channel support text')
  })

  it('Should list video channels', async function () {
    const res = await getVideoChannelsList(servers[0].url, 1, 1, '-name')

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('root_channel')
    expect(res.body.data[0].displayName).to.equal('Main root channel')
  })

  it('Should update video channel', async function () {
    this.timeout(15000)

    const videoChannelAttributes = {
      displayName: 'video channel updated',
      description: 'video channel description updated',
      support: 'support updated'
    }

    await updateVideoChannel(servers[0].url, servers[0].accessToken, 'second_video_channel', videoChannelAttributes)

    await waitJobs(servers)
  })

  it('Should have video channel updated', async function () {
    for (const server of servers) {
      const res = await getVideoChannelsList(server.url, 0, 1, '-name')

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].name).to.equal('second_video_channel')
      expect(res.body.data[0].displayName).to.equal('video channel updated')
      expect(res.body.data[0].description).to.equal('video channel description updated')
      expect(res.body.data[0].support).to.equal('support updated')
    }
  })

  it('Should not have updated the video support field', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video: VideoDetails = res.body

      expect(video.support).to.equal('video support field')
    }
  })

  it('Should update the channel support field and update videos too', async function () {
    this.timeout(35000)

    const videoChannelAttributes = {
      support: 'video channel support text updated',
      bulkVideosSupportUpdate: true
    }

    await updateVideoChannel(servers[0].url, servers[0].accessToken, 'second_video_channel', videoChannelAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video: VideoDetails = res.body

      expect(video.support).to.equal(videoChannelAttributes.support)
    }
  })

  it('Should update video channel avatar', async function () {
    this.timeout(5000)

    const fixture = 'avatar.png'

    await updateVideoChannelAvatar({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      videoChannelName: 'second_video_channel',
      fixture
    })

    await waitJobs(servers)
  })

  it('Should have video channel avatar updated', async function () {
    for (const server of servers) {
      const res = await getVideoChannelsList(server.url, 0, 1, '-name')

      const videoChannel = res.body.data.find(c => c.id === secondVideoChannelId)

      await testImage(server.url, 'avatar-resized', videoChannel.avatar.path, '.png')
    }
  })

  it('Should get video channel', async function () {
    const res = await getVideoChannel(servers[0].url, 'second_video_channel')

    const videoChannel = res.body
    expect(videoChannel.name).to.equal('second_video_channel')
    expect(videoChannel.displayName).to.equal('video channel updated')
    expect(videoChannel.description).to.equal('video channel description updated')
    expect(videoChannel.support).to.equal('video channel support text updated')
  })

  it('Should list the second video channel videos', async function () {
    this.timeout(10000)

    for (const server of servers) {
      const channelURI = 'second_video_channel@localhost:' + servers[0].port
      const res1 = await getVideoChannelVideos(server.url, server.accessToken, channelURI, 0, 5)
      expect(res1.body.total).to.equal(1)
      expect(res1.body.data).to.be.an('array')
      expect(res1.body.data).to.have.lengthOf(1)
      expect(res1.body.data[0].name).to.equal('my video name')
    }
  })

  it('Should change the video channel of a video', async function () {
    this.timeout(10000)

    await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { channelId: firstVideoChannelId })

    await waitJobs(servers)
  })

  it('Should list the first video channel videos', async function () {
    this.timeout(10000)

    for (const server of servers) {
      const secondChannelURI = 'second_video_channel@localhost:' + servers[0].port
      const res1 = await getVideoChannelVideos(server.url, server.accessToken, secondChannelURI, 0, 5)
      expect(res1.body.total).to.equal(0)

      const channelURI = 'root_channel@localhost:' + servers[0].port
      const res2 = await getVideoChannelVideos(server.url, server.accessToken, channelURI, 0, 5)
      expect(res2.body.total).to.equal(1)

      const videos: Video[] = res2.body.data
      expect(videos).to.be.an('array')
      expect(videos).to.have.lengthOf(1)
      expect(videos[0].name).to.equal('my video name')
    }
  })

  it('Should delete video channel', async function () {
    await deleteVideoChannel(servers[0].url, servers[0].accessToken, 'second_video_channel')
  })

  it('Should have video channel deleted', async function () {
    const res = await getVideoChannelsList(servers[0].url, 0, 10)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].displayName).to.equal('Main root channel')
  })

  it('Should create the main channel with an uuid if there is a conflict', async function () {
    {
      const videoChannel = { name: 'toto_channel', displayName: 'My toto channel' }
      await addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel)
    }

    {
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: 'toto', password: 'password' })
      const accessToken = await userLogin(servers[0], { username: 'toto', password: 'password' })

      const res = await getMyUserInformation(servers[0].url, accessToken)
      const videoChannel = res.body.videoChannels[0]
      expect(videoChannel.name).to.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
    }
  })

  it('Should report correct channel views per days', async function () {
    this.timeout(10000)

    {
      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        withStats: true
      })

      const channels: VideoChannel[] = res.body.data

      for (const channel of channels) {
        expect(channel).to.haveOwnProperty('viewsPerDay')
        expect(channel.viewsPerDay).to.have.length(30 + 1) // daysPrior + today

        for (const v of channel.viewsPerDay) {
          expect(v.date).to.be.an('string')
          expect(v.views).to.equal(0)
        }
      }
    }

    {
      // video has been posted on channel firstVideoChannelId since last update
      await viewVideo(servers[0].url, videoUUID, 204, '0.0.0.1,127.0.0.1')
      await viewVideo(servers[0].url, videoUUID, 204, '0.0.0.2,127.0.0.1')

      // Wait the repeatable job
      await wait(8000)

      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        withStats: true
      })
      const channelWithView = res.body.data.find((channel: VideoChannel) => channel.id === firstVideoChannelId)
      expect(channelWithView.viewsPerDay.slice(-1)[0].views).to.equal(2)
    }
  })

  it('Should report correct videos count', async function () {
    const res = await getAccountVideoChannelsList({
      url: servers[0].url,
      accountName: userInfo.account.name + '@' + userInfo.account.host,
      withStats: true
    })
    const channels: VideoChannel[] = res.body.data

    const totoChannel = channels.find(c => c.name === 'toto_channel')
    const rootChannel = channels.find(c => c.name === 'root_channel')

    expect(rootChannel.videosCount).to.equal(1)
    expect(totoChannel.videosCount).to.equal(0)
  })

  it('Should search among account video channels', async function () {
    {
      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        search: 'root'
      })
      expect(res.body.total).to.equal(1)

      const channels = res.body.data
      expect(channels).to.have.lengthOf(1)
    }

    {
      const res = await getAccountVideoChannelsList({
        url: servers[0].url,
        accountName: userInfo.account.name + '@' + userInfo.account.host,
        search: 'does not exist'
      })
      expect(res.body.total).to.equal(0)

      const channels = res.body.data
      expect(channels).to.have.lengthOf(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
