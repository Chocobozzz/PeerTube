/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test ActivityPub videos search', function () {
  let servers: PeerTubeServer[]
  let videoServer1UUID: string
  let videoServer2UUID: string

  let command: SearchCommand

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video 1 on server 1' } })
      videoServer1UUID = uuid
    }

    {
      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video 1 on server 2' } })
      videoServer2UUID = uuid
    }

    await waitJobs(servers)

    command = servers[0].search
  })

  it('Should not find a remote video', async function () {
    {
      const search = servers[1].url + '/videos/watch/43'
      const body = await command.searchVideos({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }

    {
      // Without token
      const search = servers[1].url + '/videos/watch/' + videoServer2UUID
      const body = await command.searchVideos({ search })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should search a local video', async function () {
    const search = servers[0].url + '/videos/watch/' + videoServer1UUID
    const body = await command.searchVideos({ search })

    expect(body.total).to.equal(1)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)
    expect(body.data[0].name).to.equal('video 1 on server 1')
  })

  it('Should search a local video with an alternative URL', async function () {
    const search = servers[0].url + '/w/' + videoServer1UUID
    const body1 = await command.searchVideos({ search })
    const body2 = await command.searchVideos({ search, token: servers[0].accessToken })

    for (const body of [ body1, body2 ]) {
      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('video 1 on server 1')
    }
  })

  it('Should search a local video with a query in URL', async function () {
    const searches = [
      servers[0].url + '/w/' + videoServer1UUID,
      servers[0].url + '/videos/watch/' + videoServer1UUID
    ]

    for (const search of searches) {
      for (const token of [ undefined, servers[0].accessToken ]) {
        const body = await command.searchVideos({ search: search + '?startTime=4', token })

        expect(body.total).to.equal(1)
        expect(body.data).to.be.an('array')
        expect(body.data).to.have.lengthOf(1)
        expect(body.data[0].name).to.equal('video 1 on server 1')
      }
    }
  })

  it('Should search a remote video', async function () {
    const searches = [
      servers[1].url + '/w/' + videoServer2UUID,
      servers[1].url + '/videos/watch/' + videoServer2UUID
    ]

    for (const search of searches) {
      const body = await command.searchVideos({ search, token: servers[0].accessToken })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
      expect(body.data[0].name).to.equal('video 1 on server 2')
    }
  })

  it('Should not list this remote video', async function () {
    const { total, data } = await servers[0].videos.list()
    expect(total).to.equal(1)
    expect(data).to.have.lengthOf(1)
    expect(data[0].name).to.equal('video 1 on server 1')
  })

  it('Should update video of server 2, and refresh it on server 1', async function () {
    this.timeout(120000)

    const channelAttributes = {
      name: 'super_channel',
      displayName: 'super channel'
    }
    const created = await servers[1].channels.create({ attributes: channelAttributes })
    const videoChannelId = created.id

    const attributes = {
      name: 'updated',
      tag: [ 'tag1', 'tag2' ],
      privacy: VideoPrivacy.UNLISTED,
      channelId: videoChannelId
    }
    await servers[1].videos.update({ id: videoServer2UUID, attributes })

    await waitJobs(servers)
    // Expire video
    await wait(10000)

    // Will run refresh async
    const search = servers[1].url + '/videos/watch/' + videoServer2UUID
    await command.searchVideos({ search, token: servers[0].accessToken })

    // Wait refresh
    await wait(5000)

    const body = await command.searchVideos({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)

    const video = body.data[0]
    expect(video.name).to.equal('updated')
    expect(video.channel.name).to.equal('super_channel')
    expect(video.privacy.id).to.equal(VideoPrivacy.UNLISTED)
  })

  it('Should delete video of server 2, and delete it on server 1', async function () {
    this.timeout(120000)

    await servers[1].videos.remove({ id: videoServer2UUID })

    await waitJobs(servers)
    // Expire video
    await wait(10000)

    // Will run refresh async
    const search = servers[1].url + '/videos/watch/' + videoServer2UUID
    await command.searchVideos({ search, token: servers[0].accessToken })

    // Wait refresh
    await wait(5000)

    const body = await command.searchVideos({ search, token: servers[0].accessToken })
    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
