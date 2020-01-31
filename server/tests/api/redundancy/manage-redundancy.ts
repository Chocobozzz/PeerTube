/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  getLocalIdByUUID,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  uploadVideoAndGetId,
  waitUntilLog
} from '../../../../shared/extra-utils'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { addVideoRedundancy, listVideoRedundancies, removeVideoRedundancy, updateRedundancy } from '@shared/extra-utils/server/redundancy'
import { VideoPrivacy, VideoRedundanciesTarget, VideoRedundancy } from '@shared/models'

const expect = chai.expect

describe('Test manage videos redundancy', function () {
  const targets: VideoRedundanciesTarget[] = [ 'my-videos', 'remote-videos' ]

  let servers: ServerInfo[]
  let video1Server2UUID: string
  let video2Server2UUID: string
  let redundanciesToRemove: number[] = []

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
    servers = await flushAndRunMultipleServers(3, config)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 1 server 2' })
      video1Server2UUID = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 2 server 2' })
      video2Server2UUID = res.body.video.uuid
    }

    await waitJobs(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    await updateRedundancy(servers[0].url, servers[0].accessToken, servers[1].host, true)

    await waitJobs(servers)
  })

  it('Should not have redundancies on server 3', async function () {
    for (const target of targets) {
      const res = await listVideoRedundancies({
        url: servers[2].url,
        accessToken: servers[2].accessToken,
        target
      })

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should not have "remote-videos" redundancies on server 2', async function () {
    this.timeout(120000)

    await waitJobs(servers)
    await waitUntilLog(servers[0], 'Duplicated ', 10)
    await waitJobs(servers)

    const res = await listVideoRedundancies({
      url: servers[1].url,
      accessToken: servers[1].accessToken,
      target: 'remote-videos'
    })

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should have "my-videos" redundancies on server 2', async function () {
    this.timeout(120000)

    const res = await listVideoRedundancies({
      url: servers[1].url,
      accessToken: servers[1].accessToken,
      target: 'my-videos'
    })

    expect(res.body.total).to.equal(2)

    const videos = res.body.data as VideoRedundancy[]
    expect(videos).to.have.lengthOf(2)

    const videos1 = videos.find(v => v.uuid === video1Server2UUID)
    const videos2 = videos.find(v => v.uuid === video2Server2UUID)

    expect(videos1.name).to.equal('video 1 server 2')
    expect(videos2.name).to.equal('video 2 server 2')

    expect(videos1.redundancies.files).to.have.lengthOf(4)
    expect(videos1.redundancies.streamingPlaylists).to.have.lengthOf(1)

    const redundancies = videos1.redundancies.files.concat(videos1.redundancies.streamingPlaylists)

    for (const r of redundancies) {
      expect(r.strategy).to.be.null
      expect(r.fileUrl).to.exist
      expect(r.createdAt).to.exist
      expect(r.updatedAt).to.exist
      expect(r.expiresOn).to.exist
    }
  })

  it('Should not have "my-videos" redundancies on server 1', async function () {
    const res = await listVideoRedundancies({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      target: 'my-videos'
    })

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should have "remote-videos" redundancies on server 1', async function () {
    this.timeout(120000)

    const res = await listVideoRedundancies({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      target: 'remote-videos'
    })

    expect(res.body.total).to.equal(2)

    const videos = res.body.data as VideoRedundancy[]
    expect(videos).to.have.lengthOf(2)

    const videos1 = videos.find(v => v.uuid === video1Server2UUID)
    const videos2 = videos.find(v => v.uuid === video2Server2UUID)

    expect(videos1.name).to.equal('video 1 server 2')
    expect(videos2.name).to.equal('video 2 server 2')

    expect(videos1.redundancies.files).to.have.lengthOf(4)
    expect(videos1.redundancies.streamingPlaylists).to.have.lengthOf(1)

    const redundancies = videos1.redundancies.files.concat(videos1.redundancies.streamingPlaylists)

    for (const r of redundancies) {
      expect(r.strategy).to.equal('recently-added')
      expect(r.fileUrl).to.exist
      expect(r.createdAt).to.exist
      expect(r.updatedAt).to.exist
      expect(r.expiresOn).to.exist
    }
  })

  it('Should correctly paginate and sort results', async function () {
    {
      const res = await listVideoRedundancies({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        target: 'remote-videos',
        sort: 'name',
        start: 0,
        count: 2
      })

      const videos = res.body.data
      expect(videos[0].name).to.equal('video 1 server 2')
      expect(videos[1].name).to.equal('video 2 server 2')
    }

    {
      const res = await listVideoRedundancies({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 2
      })

      const videos = res.body.data
      expect(videos[0].name).to.equal('video 2 server 2')
      expect(videos[1].name).to.equal('video 1 server 2')
    }

    {
      const res = await listVideoRedundancies({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        target: 'remote-videos',
        sort: '-name',
        start: 1,
        count: 1
      })

      const videos = res.body.data
      expect(videos[0].name).to.equal('video 1 server 2')
    }
  })

  it('Should manually add a redundancy and list it', async function () {
    this.timeout(120000)

    const uuid = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video 3 server 2', privacy: VideoPrivacy.UNLISTED })).uuid
    await waitJobs(servers)
    const videoId = await getLocalIdByUUID(servers[0].url, uuid)

    await addVideoRedundancy({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      videoId
    })

    await waitJobs(servers)
    await waitUntilLog(servers[0], 'Duplicated ', 15)
    await waitJobs(servers)

    {
      const res = await listVideoRedundancies({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 5
      })

      const videos = res.body.data
      expect(videos[0].name).to.equal('video 3 server 2')

      const video = videos[0]
      expect(video.redundancies.files).to.have.lengthOf(4)
      expect(video.redundancies.streamingPlaylists).to.have.lengthOf(1)

      const redundancies = video.redundancies.files.concat(video.redundancies.streamingPlaylists)

      for (const r of redundancies) {
        redundanciesToRemove.push(r.id)

        expect(r.strategy).to.equal('manual')
        expect(r.fileUrl).to.exist
        expect(r.createdAt).to.exist
        expect(r.updatedAt).to.exist
        expect(r.expiresOn).to.be.null
      }
    }

    const res = await listVideoRedundancies({
      url: servers[1].url,
      accessToken: servers[1].accessToken,
      target: 'my-videos',
      sort: '-name',
      start: 0,
      count: 5
    })

    const videos = res.body.data
    expect(videos[0].name).to.equal('video 3 server 2')

    const video = videos[0]
    expect(video.redundancies.files).to.have.lengthOf(4)
    expect(video.redundancies.streamingPlaylists).to.have.lengthOf(1)

    const redundancies = video.redundancies.files.concat(video.redundancies.streamingPlaylists)

    for (const r of redundancies) {
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
      await removeVideoRedundancy({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        redundancyId
      })
    }

    {
      const res = await listVideoRedundancies({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 5
      })

      const videos = res.body.data
      expect(videos).to.have.lengthOf(2)

      expect(videos[0].name).to.equal('video 2 server 2')

      redundanciesToRemove = []
      const video = videos[0]
      expect(video.redundancies.files).to.have.lengthOf(4)
      expect(video.redundancies.streamingPlaylists).to.have.lengthOf(1)

      const redundancies = video.redundancies.files.concat(video.redundancies.streamingPlaylists)

      for (const r of redundancies) {
        redundanciesToRemove.push(r.id)
      }
    }
  })

  it('Should remove another (auto) redundancy', async function () {
    {
      for (const redundancyId of redundanciesToRemove) {
        await removeVideoRedundancy({
          url: servers[0].url,
          accessToken: servers[0].accessToken,
          redundancyId
        })
      }

      const res = await listVideoRedundancies({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        target: 'remote-videos',
        sort: '-name',
        start: 0,
        count: 5
      })

      const videos = res.body.data
      expect(videos[0].name).to.equal('video 1 server 2')
      expect(videos).to.have.lengthOf(1)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
