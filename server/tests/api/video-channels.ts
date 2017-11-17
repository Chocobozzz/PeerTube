/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  runServer,
  setAccessTokensToServers,
  killallServers,
  getMyUserInformation,
  getVideoChannelsList,
  addVideoChannel,
  getAccountVideoChannelsList,
  updateVideoChannel,
  deleteVideoChannel,
  getVideoChannel
} from '../utils'
import { User } from '../../../shared'

describe('Test a video channels', function () {
  let server: ServerInfo
  let userInfo: User
  let videoChannelId: number

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should have one video channel (created with root)', async () => {
    const res = await getVideoChannelsList(server.url, 0, 2)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
  })

  it('Should create another video channel', async () => {
    const videoChannel = {
      name: 'second video channel',
      description: 'super video channel description'
    }
    await addVideoChannel(server.url, server.accessToken, videoChannel)
  })

  it('Should have two video channels when getting my information', async () => {
    const res = await getMyUserInformation(server.url, server.accessToken)
    userInfo = res.body

    expect(userInfo.videoChannels).to.be.an('array')
    expect(userInfo.videoChannels).to.have.lengthOf(2)

    const videoChannels = userInfo.videoChannels
    expect(videoChannels[0].name).to.equal('Default root channel')
    expect(videoChannels[1].name).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')
  })

  it('Should have two video channels when getting account channels', async () => {
    const res = await getAccountVideoChannelsList(server.url, userInfo.account.uuid)

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(2)

    const videoChannels = res.body.data
    expect(videoChannels[0].name).to.equal('Default root channel')
    expect(videoChannels[1].name).to.equal('second video channel')
    expect(videoChannels[1].description).to.equal('super video channel description')

    videoChannelId = videoChannels[1].id
  })

  it('Should list video channels', async () => {
    const res = await getVideoChannelsList(server.url, 1, 1, '-name')

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('Default root channel')
  })

  it('Should update video channel', async () => {
    const videoChannelAttributes = {
      name: 'video channel updated',
      description: 'video channel description updated'
    }

    await updateVideoChannel(server.url, server.accessToken, videoChannelId, videoChannelAttributes)
  })

  it('Should have video channel updated', async () => {
    const res = await getVideoChannelsList(server.url, 0, 1, '-name')

    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('video channel updated')
    expect(res.body.data[0].description).to.equal('video channel description updated')
  })

  it('Should get video channel', async () => {
    const res = await getVideoChannel(server.url, videoChannelId)

    const videoChannel = res.body
    expect(videoChannel.name).to.equal('video channel updated')
    expect(videoChannel.description).to.equal('video channel description updated')
  })

  it('Should delete video channel', async () => {
    await deleteVideoChannel(server.url, server.accessToken, videoChannelId)
  })

  it('Should have video channel deleted', async () => {
    const res = await getVideoChannelsList(server.url, 0, 10)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('Default root channel')
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
