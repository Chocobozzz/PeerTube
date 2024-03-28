/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { ActorImageType, User, VideoChannel } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { ACTOR_IMAGES_SIZE } from '@peertube/peertube-server/core/initializers/constants.js'
import { testFileExistsOnFSOrNot, testImage } from '@tests/shared/checks.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { basename } from 'path'

async function findChannel (server: PeerTubeServer, channelId: number) {
  const body = await server.channels.list({ sort: '-name' })

  return body.data.find(c => c.id === channelId)
}

describe('Test video channels', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[] = []

  let userInfo: User
  let secondVideoChannelId: number
  let totoChannel: number
  let videoUUID: string
  let accountName: string
  let secondUserChannelName: string

  const avatarPaths: { [ port: number ]: string } = {}
  const bannerPaths: { [ port: number ]: string } = {}

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    await doubleFollow(servers[0], servers[1])

    sqlCommands = servers.map(s => new SQLCommand(s))
  })

  it('Should have one video channel (created with root)', async () => {
    const body = await servers[0].channels.list({ start: 0, count: 2 })

    expect(body.total).to.equal(1)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)
  })

  it('Should create another video channel', async function () {
    this.timeout(30000)

    {
      const videoChannel = {
        name: 'second_video_channel',
        displayName: 'second video channel',
        description: 'super video channel description',
        support: 'super video channel support text'
      }
      const created = await servers[0].channels.create({ attributes: videoChannel })
      secondVideoChannelId = created.id
    }

    // The channel is 1 is propagated to servers 2
    {
      const attributes = { name: 'my video name', channelId: secondVideoChannelId, support: 'video support field' }
      const { uuid } = await servers[0].videos.upload({ attributes })
      videoUUID = uuid
    }

    await waitJobs(servers)
  })

  it('Should have two video channels when getting my information', async () => {
    userInfo = await servers[0].users.getMyInfo()

    expect(userInfo.videoChannels).to.be.an('array')
    expect(userInfo.videoChannels).to.have.lengthOf(2)

    const videoChannels = userInfo.videoChannels
    expect(videoChannels[0].name).to.equal('root_channel')
    expect(videoChannels[0].displayName).to.equal('Main root channel')

    expect(videoChannels[1].name).to.equal('second_video_channel')
    expect(videoChannels[1].displayName).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
    expect(videoChannels[1].support).to.equal('super video channel support text')

    accountName = userInfo.account.name + '@' + userInfo.account.host
  })

  it('Should have two video channels when getting account channels on server 1', async function () {
    const body = await servers[0].channels.listByAccount({ accountName })
    expect(body.total).to.equal(2)

    const videoChannels = body.data

    expect(videoChannels).to.be.an('array')
    expect(videoChannels).to.have.lengthOf(2)

    expect(videoChannels[0].name).to.equal('root_channel')
    expect(videoChannels[0].displayName).to.equal('Main root channel')

    expect(videoChannels[1].name).to.equal('second_video_channel')
    expect(videoChannels[1].displayName).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
    expect(videoChannels[1].support).to.equal('super video channel support text')
  })

  it('Should paginate and sort account channels', async function () {
    {
      const body = await servers[0].channels.listByAccount({
        accountName,
        start: 0,
        count: 1,
        sort: 'createdAt'
      })

      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(1)

      const videoChannel: VideoChannel = body.data[0]
      expect(videoChannel.name).to.equal('root_channel')
    }

    {
      const body = await servers[0].channels.listByAccount({
        accountName,
        start: 0,
        count: 1,
        sort: '-createdAt'
      })

      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('second_video_channel')
    }

    {
      const body = await servers[0].channels.listByAccount({
        accountName,
        start: 1,
        count: 1,
        sort: '-createdAt'
      })

      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('root_channel')
    }
  })

  it('Should have one video channel when getting account channels on server 2', async function () {
    const body = await servers[1].channels.listByAccount({ accountName })

    expect(body.total).to.equal(1)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)

    const videoChannel = body.data[0]
    expect(videoChannel.name).to.equal('second_video_channel')
    expect(videoChannel.displayName).to.equal('second video channel')
    expect(videoChannel.description).to.equal('super video channel description')
    expect(videoChannel.support).to.equal('super video channel support text')
  })

  it('Should list video channels', async function () {
    const body = await servers[0].channels.list({ start: 1, count: 1, sort: '-name' })

    expect(body.total).to.equal(2)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)
    expect(body.data[0].name).to.equal('root_channel')
    expect(body.data[0].displayName).to.equal('Main root channel')
  })

  it('Should update video channel', async function () {
    this.timeout(15000)

    const videoChannelAttributes = {
      displayName: 'video channel updated',
      description: 'video channel description updated',
      support: 'support updated'
    }

    await servers[0].channels.update({ channelName: 'second_video_channel', attributes: videoChannelAttributes })

    await waitJobs(servers)
  })

  it('Should have video channel updated', async function () {
    for (const server of servers) {
      const body = await server.channels.list({ start: 0, count: 1, sort: '-name' })

      expect(body.total).to.equal(2)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)

      expect(body.data[0].name).to.equal('second_video_channel')
      expect(body.data[0].displayName).to.equal('video channel updated')
      expect(body.data[0].description).to.equal('video channel description updated')
      expect(body.data[0].support).to.equal('support updated')
    }
  })

  it('Should not have updated the video support field', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })
      expect(video.support).to.equal('video support field')
    }
  })

  it('Should update another accounts video channel', async function () {
    this.timeout(15000)

    const result = await servers[0].users.generate('second_user')
    secondUserChannelName = result.userChannelName

    await servers[0].videos.quickUpload({ name: 'video', token: result.token })

    const videoChannelAttributes = {
      displayName: 'video channel updated',
      description: 'video channel description updated',
      support: 'support updated'
    }

    await servers[0].channels.update({ channelName: secondUserChannelName, attributes: videoChannelAttributes })

    await waitJobs(servers)
  })

  it('Should have another accounts video channel updated', async function () {
    for (const server of servers) {
      const body = await server.channels.get({ channelName: `${secondUserChannelName}@${servers[0].host}` })

      expect(body.displayName).to.equal('video channel updated')
      expect(body.description).to.equal('video channel description updated')
      expect(body.support).to.equal('support updated')
    }
  })

  it('Should update the channel support field and update videos too', async function () {
    this.timeout(35000)

    const videoChannelAttributes = {
      support: 'video channel support text updated',
      bulkVideosSupportUpdate: true
    }

    await servers[0].channels.update({ channelName: 'second_video_channel', attributes: videoChannelAttributes })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })
      expect(video.support).to.equal(videoChannelAttributes.support)
    }
  })

  it('Should update video channel avatar', async function () {
    this.timeout(15000)

    const fixture = 'avatar.png'

    await servers[0].channels.updateImage({
      channelName: 'second_video_channel',
      fixture,
      type: 'avatar'
    })

    await waitJobs(servers)

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i]

      const videoChannel = await findChannel(server, secondVideoChannelId)
      const expectedSizes = ACTOR_IMAGES_SIZE[ActorImageType.AVATAR]

      expect(videoChannel.avatars.length).to.equal(expectedSizes.length, 'Expected avatars to be generated in all sizes')

      for (const avatar of videoChannel.avatars) {
        avatarPaths[server.port] = avatar.path
        await testImage(server.url, `avatar-resized-${avatar.width}x${avatar.width}`, avatarPaths[server.port], '.png')
        await testFileExistsOnFSOrNot(server, 'avatars', basename(avatarPaths[server.port]), true)

        const row = await sqlCommands[i].getActorImage(basename(avatarPaths[server.port]))

        expect(expectedSizes.some(({ height, width }) => row.height === height && row.width === width)).to.equal(true)
      }
    }
  })

  it('Should update video channel banner', async function () {
    this.timeout(15000)

    const fixture = 'banner.jpg'

    await servers[0].channels.updateImage({
      channelName: 'second_video_channel',
      fixture,
      type: 'banner'
    })

    await waitJobs(servers)

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i]

      const videoChannel = await server.channels.get({ channelName: 'second_video_channel@' + servers[0].host })
      const expectedSizes = ACTOR_IMAGES_SIZE[ActorImageType.BANNER]

      expect(videoChannel.banners.length).to.equal(expectedSizes.length, 'Expected banners to be generated in all sizes')

      for (const banner of videoChannel.banners) {
        bannerPaths[server.port] = banner.path
        await testImage(server.url, `banner-resized-${banner.width}`, bannerPaths[server.port])
        await testFileExistsOnFSOrNot(server, 'avatars', basename(bannerPaths[server.port]), true)

        const row = await sqlCommands[i].getActorImage(basename(bannerPaths[server.port]))
        expect(expectedSizes.some(({ height, width }) => row.height === height && row.width === width)).to.equal(true)
      }
    }
  })

  it('Should still correctly list channels', async function () {
    {
      const body = await servers[0].channels.list({ start: 1, count: 1, sort: 'createdAt' })

      expect(body.total).to.equal(3)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('second_video_channel')
    }

    {
      const body = await servers[0].channels.listByAccount({ accountName, start: 1, count: 1, sort: 'createdAt' })

      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('second_video_channel')
    }
  })

  it('Should delete the video channel avatar', async function () {
    this.timeout(15000)
    await servers[0].channels.deleteImage({ channelName: 'second_video_channel', type: 'avatar' })

    await waitJobs(servers)

    for (const server of servers) {
      const videoChannel = await findChannel(server, secondVideoChannelId)
      await testFileExistsOnFSOrNot(server, 'avatars', basename(avatarPaths[server.port]), false)

      expect(videoChannel.avatars).to.be.empty
    }
  })

  it('Should delete the video channel banner', async function () {
    this.timeout(15000)

    await servers[0].channels.deleteImage({ channelName: 'second_video_channel', type: 'banner' })

    await waitJobs(servers)

    for (const server of servers) {
      const videoChannel = await findChannel(server, secondVideoChannelId)
      await testFileExistsOnFSOrNot(server, 'avatars', basename(bannerPaths[server.port]), false)

      expect(videoChannel.banners).to.be.empty
    }
  })

  it('Should list the second video channel videos', async function () {
    for (const server of servers) {
      const channelURI = 'second_video_channel@' + servers[0].host
      const { total, data } = await server.videos.listByChannel({ handle: channelURI })

      expect(total).to.equal(1)
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('my video name')
    }
  })

  it('Should change the video channel of a video', async function () {
    await servers[0].videos.update({ id: videoUUID, attributes: { channelId: servers[0].store.channel.id } })

    await waitJobs(servers)
  })

  it('Should list the first video channel videos', async function () {
    for (const server of servers) {
      {
        const secondChannelURI = 'second_video_channel@' + servers[0].host
        const { total } = await server.videos.listByChannel({ handle: secondChannelURI })
        expect(total).to.equal(0)
      }

      {
        const channelURI = 'root_channel@' + servers[0].host
        const { total, data } = await server.videos.listByChannel({ handle: channelURI })
        expect(total).to.equal(1)

        expect(data).to.be.an('array')
        expect(data).to.have.lengthOf(1)
        expect(data[0].name).to.equal('my video name')
      }
    }
  })

  it('Should delete video channel', async function () {
    await servers[0].channels.delete({ channelName: 'second_video_channel' })
  })

  it('Should have video channel deleted', async function () {
    const body = await servers[0].channels.list({ start: 0, count: 10, sort: 'createdAt' })

    expect(body.total).to.equal(2)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(2)
    expect(body.data[0].displayName).to.equal('Main root channel')
    expect(body.data[1].displayName).to.equal('video channel updated')
  })

  it('Should create the main channel with a suffix if there is a conflict', async function () {
    {
      const videoChannel = { name: 'toto_channel', displayName: 'My toto channel' }
      const created = await servers[0].channels.create({ attributes: videoChannel })
      totoChannel = created.id
    }

    {
      await servers[0].users.create({ username: 'toto', password: 'password' })
      const accessToken = await servers[0].login.getAccessToken({ username: 'toto', password: 'password' })

      const { videoChannels } = await servers[0].users.getMyInfo({ token: accessToken })
      expect(videoChannels[0].name).to.equal('toto_channel-1')
    }
  })

  it('Should report correct channel views per days', async function () {
    {
      const { data } = await servers[0].channels.listByAccount({ accountName, withStats: true })

      for (const channel of data) {
        expect(channel).to.haveOwnProperty('viewsPerDay')
        expect(channel.viewsPerDay).to.have.length(30 + 1) // daysPrior + today

        for (const v of channel.viewsPerDay) {
          expect(v.date).to.be.an('string')
          expect(v.views).to.equal(0)
        }
      }
    }

    {
      // video has been posted on channel servers[0].store.videoChannel.id since last update
      await servers[0].views.simulateView({ id: videoUUID, xForwardedFor: '0.0.0.1,127.0.0.1' })
      await servers[0].views.simulateView({ id: videoUUID, xForwardedFor: '0.0.0.2,127.0.0.1' })

      // Wait the repeatable job
      await wait(8000)

      const { data } = await servers[0].channels.listByAccount({ accountName, withStats: true })
      const channelWithView = data.find(channel => channel.id === servers[0].store.channel.id)
      expect(channelWithView.viewsPerDay.slice(-1)[0].views).to.equal(2)
    }
  })

  it('Should report correct total views count', async function () {
    // check if there's the property
    {
      const { data } = await servers[0].channels.listByAccount({ accountName, withStats: true })

      for (const channel of data) {
        expect(channel).to.haveOwnProperty('totalViews')
        expect(channel.totalViews).to.be.a('number')
      }
    }

    // Check if the totalViews count can be updated
    {
      const { data } = await servers[0].channels.listByAccount({ accountName, withStats: true })
      const channelWithView = data.find(channel => channel.id === servers[0].store.channel.id)
      expect(channelWithView.totalViews).to.equal(2)
    }
  })

  it('Should report correct videos count', async function () {
    const { data } = await servers[0].channels.listByAccount({ accountName, withStats: true })

    const totoChannel = data.find(c => c.name === 'toto_channel')
    const rootChannel = data.find(c => c.name === 'root_channel')

    expect(rootChannel.videosCount).to.equal(1)
    expect(totoChannel.videosCount).to.equal(0)
  })

  it('Should search among account video channels', async function () {
    {
      const body = await servers[0].channels.listByAccount({ accountName, search: 'root' })
      expect(body.total).to.equal(1)

      const channels = body.data
      expect(channels).to.have.lengthOf(1)
    }

    {
      const body = await servers[0].channels.listByAccount({ accountName, search: 'does not exist' })
      expect(body.total).to.equal(0)

      const channels = body.data
      expect(channels).to.have.lengthOf(0)
    }
  })

  it('Should list channels by updatedAt desc if a video has been uploaded', async function () {
    this.timeout(60000)

    await servers[0].videos.upload({ attributes: { channelId: totoChannel } })
    await waitJobs(servers)

    for (const server of servers) {
      const { data } = await server.channels.listByAccount({ accountName, sort: '-updatedAt' })

      expect(data[0].name).to.equal('toto_channel')
      expect(data[1].name).to.equal('root_channel')
    }

    await servers[0].videos.upload({ attributes: { channelId: servers[0].store.channel.id } })
    await waitJobs(servers)

    for (const server of servers) {
      const { data } = await server.channels.listByAccount({ accountName, sort: '-updatedAt' })

      expect(data[0].name).to.equal('root_channel')
      expect(data[1].name).to.equal('toto_channel')
    }
  })

  it('Should apply another default channel name', async function () {
    this.timeout(15000)

    await servers[0].config.updateExistingConfig({
      newConfig: {
        user: {
          defaultChannelName: `$1's channel`
        }
      }
    })

    await servers[0].users.generate('third_user')

    const body = await servers[0].channels.listByAccount({ accountName: 'third_user' })

    expect(body.total).to.equal(1)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)

    const videoChannel = body.data[0]
    expect(videoChannel.displayName).to.equal(`third_user's channel`)
    expect(videoChannel.name).to.equal('third_user_channel')
  })

  after(async function () {
    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
})
