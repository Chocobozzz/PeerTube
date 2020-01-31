/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  addVideoChannel,
  cleanupTests,
  flushAndRunMultipleServers,
  getVideosList,
  removeVideo,
  searchVideo,
  searchVideoWithToken,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  wait
} from '../../../../shared/extra-utils'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { Video, VideoPrivacy } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test ActivityPub videos search', function () {
  let servers: ServerInfo[]
  let videoServer1UUID: string
  let videoServer2UUID: string

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video 1 on server 1' })
      videoServer1UUID = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 1 on server 2' })
      videoServer2UUID = res.body.video.uuid
    }

    await waitJobs(servers)
  })

  it('Should not find a remote video', async function () {
    {
      const search = 'http://localhost:' + servers[1].port + '/videos/watch/43'
      const res = await searchVideoWithToken(servers[0].url, search, servers[0].accessToken)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      // Without token
      const search = 'http://localhost:' + servers[1].port + '/videos/watch/' + videoServer2UUID
      const res = await searchVideo(servers[0].url, search)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should search a local video', async function () {
    const search = 'http://localhost:' + servers[0].port + '/videos/watch/' + videoServer1UUID
    const res = await searchVideo(servers[0].url, search)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('video 1 on server 1')
  })

  it('Should search a remote video', async function () {
    const search = 'http://localhost:' + servers[1].port + '/videos/watch/' + videoServer2UUID
    const res = await searchVideoWithToken(servers[0].url, search, servers[0].accessToken)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('video 1 on server 2')
  })

  it('Should not list this remote video', async function () {
    const res = await getVideosList(servers[0].url)
    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].name).to.equal('video 1 on server 1')
  })

  it('Should update video of server 2, and refresh it on server 1', async function () {
    this.timeout(60000)

    const channelAttributes = {
      name: 'super_channel',
      displayName: 'super channel'
    }
    const resChannel = await addVideoChannel(servers[1].url, servers[1].accessToken, channelAttributes)
    const videoChannelId = resChannel.body.videoChannel.id

    const attributes = {
      name: 'updated',
      tag: [ 'tag1', 'tag2' ],
      privacy: VideoPrivacy.UNLISTED,
      channelId: videoChannelId
    }
    await updateVideo(servers[1].url, servers[1].accessToken, videoServer2UUID, attributes)

    await waitJobs(servers)
    // Expire video
    await wait(10000)

    // Will run refresh async
    const search = 'http://localhost:' + servers[1].port + '/videos/watch/' + videoServer2UUID
    await searchVideoWithToken(servers[0].url, search, servers[0].accessToken)

    // Wait refresh
    await wait(5000)

    const res = await searchVideoWithToken(servers[0].url, search, servers[0].accessToken)
    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    const video: Video = res.body.data[0]
    expect(video.name).to.equal('updated')
    expect(video.channel.name).to.equal('super_channel')
    expect(video.privacy.id).to.equal(VideoPrivacy.UNLISTED)
  })

  it('Should delete video of server 2, and delete it on server 1', async function () {
    this.timeout(60000)

    await removeVideo(servers[1].url, servers[1].accessToken, videoServer2UUID)

    await waitJobs(servers)
    // Expire video
    await wait(10000)

    // Will run refresh async
    const search = 'http://localhost:' + servers[1].port + '/videos/watch/' + videoServer2UUID
    await searchVideoWithToken(servers[0].url, search, servers[0].accessToken)

    // Wait refresh
    await wait(5000)

    const res = await searchVideoWithToken(servers[0].url, search, servers[0].accessToken)
    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
