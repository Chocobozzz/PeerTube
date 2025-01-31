/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPrivacy, VideoRedundanciesTarget } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  RedundancyCommand,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test manage videos redundancy', function () {
  const targets: VideoRedundanciesTarget[] = [ 'my-videos', 'remote-videos' ]

  let servers: PeerTubeServer[]
  let video1Server2UUID: string
  let video2Server2UUID: string
  let redundanciesToRemove: number[] = []

  let commands: RedundancyCommand[]

  before(async function () {
    this.timeout(120000)

    const config = {
      transcoding: {
        hls: {
          enabled: true
        }
      },
      redundancy: {
        videos: {
          check_interval: '1 second',
          strategies: [
            {
              strategy: 'recently-added',
              min_lifetime: '1 hour',
              size: '10MB',
              min_views: 0
            }
          ]
        }
      }
    }
    servers = await createMultipleServers(3, config)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    commands = servers.map(s => s.redundancy)

    {
      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video 1 server 2' } })
      video1Server2UUID = uuid
    }

    {
      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video 2 server 2' } })
      video2Server2UUID = uuid
    }

    await waitJobs(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    await doubleFollow(servers[0], servers[2])
    await commands[0].updateRedundancy({ host: servers[1].host, redundancyAllowed: true })

    await waitJobs(servers)
  })

  it('Should not have redundancies on server 3', async function () {
    for (const target of targets) {
      const body = await commands[2].listVideos({ target })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    }
  })

  it('Should correctly list followings by redundancy', async function () {
    const body = await servers[0].follows.getFollowings({ sort: '-redundancyAllowed' })

    expect(body.total).to.equal(2)
    expect(body.data).to.have.lengthOf(2)

    expect(body.data[0].following.host).to.equal(servers[1].host)
    expect(body.data[1].following.host).to.equal(servers[2].host)
  })

  it('Should not have "remote-videos" redundancies on server 2', async function () {
    this.timeout(120000)

    await waitJobs(servers)
    await servers[0].servers.waitUntilLog('Duplicated playlist ', 2)
    await waitJobs(servers)

    const body = await commands[1].listVideos({ target: 'remote-videos' })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should have "my-videos" redundancies on server 2', async function () {
    this.timeout(120000)

    const body = await commands[1].listVideos({ target: 'my-videos' })
    expect(body.total).to.equal(2)

    const videos = body.data
    expect(videos).to.have.lengthOf(2)

    const videos1 = videos.find(v => v.uuid === video1Server2UUID)
    const videos2 = videos.find(v => v.uuid === video2Server2UUID)

    expect(videos1.name).to.equal('video 1 server 2')
    expect(videos2.name).to.equal('video 2 server 2')

    expect(videos1.redundancies.files).to.have.lengthOf(0)
    expect(videos1.redundancies.streamingPlaylists).to.have.lengthOf(1)

    for (const r of videos1.redundancies.streamingPlaylists) {
      expect(r.strategy).to.be.null
      expect(r.fileUrl).to.exist
      expect(r.createdAt).to.exist
      expect(r.updatedAt).to.exist
      expect(r.expiresOn).to.exist
    }
  })

  it('Should not have "my-videos" redundancies on server 1', async function () {
    const body = await commands[0].listVideos({ target: 'my-videos' })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should have "remote-videos" redundancies on server 1', async function () {
    this.timeout(120000)

    const body = await commands[0].listVideos({ target: 'remote-videos' })
    expect(body.total).to.equal(2)

    const videos = body.data
    expect(videos).to.have.lengthOf(2)

    const videos1 = videos.find(v => v.uuid === video1Server2UUID)
    const videos2 = videos.find(v => v.uuid === video2Server2UUID)

    expect(videos1.name).to.equal('video 1 server 2')
    expect(videos2.name).to.equal('video 2 server 2')

    expect(videos1.redundancies.files).to.have.lengthOf(0)
    expect(videos1.redundancies.streamingPlaylists).to.have.lengthOf(1)

    for (const r of videos1.redundancies.streamingPlaylists) {
      expect(r.strategy).to.equal('recently-added')
      expect(r.fileUrl).to.exist
      expect(r.createdAt).to.exist
      expect(r.updatedAt).to.exist
      expect(r.expiresOn).to.exist
    }
  })

  it('Should correctly paginate and sort results', async function () {
    {
      const body = await commands[0].listVideos({
        target: 'remote-videos',
        sort: 'name',
        start: 0,
        count: 2
      })

      const videos = body.data
      expect(videos[0].name).to.equal('video 1 server 2')
      expect(videos[1].name).to.equal('video 2 server 2')
    }

    {
      const body = await commands[0].listVideos({
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 2
      })

      const videos = body.data
      expect(videos[0].name).to.equal('video 2 server 2')
      expect(videos[1].name).to.equal('video 1 server 2')
    }

    {
      const body = await commands[0].listVideos({
        target: 'remote-videos',
        sort: '-name',
        start: 1,
        count: 1
      })

      expect(body.data[0].name).to.equal('video 1 server 2')
    }
  })

  it('Should manually add a redundancy and list it', async function () {
    this.timeout(120000)

    const uuid = (await servers[1].videos.quickUpload({ name: 'video 3 server 2', privacy: VideoPrivacy.UNLISTED })).uuid
    await waitJobs(servers)
    const videoId = await servers[0].videos.getId({ uuid })

    await commands[0].addVideo({ videoId })

    await waitJobs(servers)
    await servers[0].servers.waitUntilLog('Duplicated playlist ', 3)
    await waitJobs(servers)

    {
      const body = await commands[0].listVideos({
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 5
      })

      const video = body.data[0]

      expect(video.name).to.equal('video 3 server 2')
      expect(video.redundancies.files).to.have.lengthOf(0)
      expect(video.redundancies.streamingPlaylists).to.have.lengthOf(1)

      for (const r of video.redundancies.streamingPlaylists) {
        redundanciesToRemove.push(r.id)

        expect(r.strategy).to.equal('manual')
        expect(r.fileUrl).to.exist
        expect(r.createdAt).to.exist
        expect(r.updatedAt).to.exist
        expect(r.expiresOn).to.be.null
      }
    }

    const body = await commands[1].listVideos({
      target: 'my-videos',
      sort: '-name',
      start: 0,
      count: 5
    })

    const video = body.data[0]
    expect(video.name).to.equal('video 3 server 2')
    expect(video.redundancies.files).to.have.lengthOf(0)
    expect(video.redundancies.streamingPlaylists).to.have.lengthOf(1)

    for (const r of video.redundancies.streamingPlaylists) {
      expect(r.strategy).to.be.null
      expect(r.fileUrl).to.exist
      expect(r.createdAt).to.exist
      expect(r.updatedAt).to.exist
      expect(r.expiresOn).to.be.null
    }
  })

  it('Should manually remove a redundancy and remove it from the list', async function () {
    this.timeout(120000)

    for (const redundancyId of redundanciesToRemove) {
      await commands[0].removeVideo({ redundancyId })
    }

    {
      const body = await commands[0].listVideos({
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 5
      })

      const videos = body.data

      expect(videos).to.have.lengthOf(2)

      const video = videos[0]
      expect(video.name).to.equal('video 2 server 2')
      expect(video.redundancies.files).to.have.lengthOf(0)
      expect(video.redundancies.streamingPlaylists).to.have.lengthOf(1)

      redundanciesToRemove = video.redundancies.streamingPlaylists.map(r => r.id)
    }
  })

  it('Should remove another (auto) redundancy', async function () {
    for (const redundancyId of redundanciesToRemove) {
      await commands[0].removeVideo({ redundancyId })
    }

    const body = await commands[0].listVideos({
      target: 'remote-videos',
      sort: '-name',
      start: 0,
      count: 5
    })

    const videos = body.data
    expect(videos).to.have.lengthOf(1)
    expect(videos[0].name).to.equal('video 1 server 2')
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
