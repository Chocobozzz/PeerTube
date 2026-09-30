/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { VideoDetails } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkSegmentHash } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { basename, join } from 'path'

describe('Test video redundancy in object storage', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  let server1: PeerTubeServer
  let secondary: PeerTubeServer
  let server2: PeerTubeServer

  let video: VideoDetails

  const redundancyConfig = {
    redundancy: {
      videos: {
        check_interval: '5 seconds',
        strategies: []
      }
    }
  }

  function getObjectStorageConfig () {
    return { ...objectStorage.getDefaultMockConfig(), ...redundancyConfig }
  }

  function listRedundancyKeys () {
    return objectStorage.listMockObjectKeys(objectStorage.getMockRedundancyBucketName(), 'redundancy/hls/' + video.uuid + '/')
  }

  async function getRedundancyBaseUrls (server: PeerTubeServer) {
    const { streamingPlaylists } = await server.videos.getWithToken({ id: video.uuid })

    return streamingPlaylists[0].redundancies.map(r => r.baseUrl)
  }

  async function waitForRedundancyBaseUrls (server: PeerTubeServer, count: number) {
    for (let i = 0; i < 60; i++) {
      const baseUrls = await getRedundancyBaseUrls(server)
      if (baseUrls.length === count) return baseUrls

      await wait(500)
    }

    throw new Error(`${server.url} does not have ${count} redundancies`)
  }

  async function waitForRedundancyKeys (count: 'none' | 'some') {
    for (let i = 0; i < 60; i++) {
      const keys = await listRedundancyKeys()
      if ((count === 'none') === (keys.length === 0)) return keys

      await wait(500)
    }

    throw new Error(`Redundancy bucket still has ${count === 'none' ? 'some' : 'no'} objects`)
  }

  async function getRedundancyId () {
    const { data } = await server1.redundancy.listVideos({ target: 'remote-videos' })

    return data[0].redundancies.streamingPlaylists[0].id
  }

  before(async function () {
    this.timeout(240000)

    await objectStorage.prepareDefaultMockBuckets()

    server1 = await createSingleServer(1, getObjectStorageConfig())
    server2 = await createSingleServer(2, { transcoding: { hls: { enabled: true } } })

    await setAccessTokensToServers([ server1, server2 ])

    secondary = await createSecondaryServer(server1)

    const { uuid } = await server2.videos.quickUpload({ name: 'video server 2' })
    await waitJobs([ server2 ])

    await doubleFollow(server1, server2)

    video = await server2.videos.get({ id: uuid })
  })

  describe('With object storage', function () {
    it('Should duplicate the video in object storage using the secondary', async function () {
      this.timeout(120000)

      // Only the secondary can process the redundancy job
      await server1.jobs.pauseJobQueue({ processRoles: [ 'primary' ] })

      await secondary.redundancy.addVideo({ videoId: (await server1.videos.get({ id: video.uuid })).id })

      const [ baseUrl ] = await waitForRedundancyBaseUrls(server1, 1)
      expect(baseUrl).to.equal(objectStorage.getMockRedundancyBaseUrl() + 'hls/' + video.uuid)

      await server1.jobs.resumeJobQueue({ processRoles: [ 'primary' ] })
      await waitJobs([ server1, server2 ])

      expect(await getRedundancyBaseUrls(server2)).to.deep.equal([ baseUrl ])
    })

    it('Should have the redundancy files in object storage only', async function () {
      const keys = await listRedundancyKeys()
      const filenames = keys.map(k => basename(k))

      for (const file of video.streamingPlaylists[0].files) {
        expect(filenames).to.include(basename(file.fileUrl))
      }

      expect(await pathExists(join(server1.getDirectoryPath('redundancy/hls'), video.uuid))).to.be.false
    })

    it('Should serve the segments from object storage', async function () {
      const hlsPlaylist = video.streamingPlaylists[0]
      const [ baseUrlSegment ] = await getRedundancyBaseUrls(server1)

      for (const file of hlsPlaylist.files) {
        await checkSegmentHash({
          server: server2,
          baseUrlPlaylist: server2.url + '/static/streaming-playlists/hls/' + video.uuid,
          baseUrlSegment,
          resolution: file.resolution.id,
          hlsPlaylist
        })
      }
    })

    it('Should remove the redundancy using the secondary', async function () {
      this.timeout(60000)

      await secondary.redundancy.removeVideo({ redundancyId: await getRedundancyId() })
      await waitJobs([ server1, server2 ])

      await waitForRedundancyKeys('none')

      expect(await getRedundancyBaseUrls(server1)).to.have.lengthOf(0)
      expect(await getRedundancyBaseUrls(server2)).to.have.lengthOf(0)
    })

    it('Should remove the redundancy files when the remote video is deleted', async function () {
      this.timeout(120000)

      await server1.redundancy.addVideo({ videoId: (await server1.videos.get({ id: video.uuid })).id })
      await waitForRedundancyBaseUrls(server1, 1)
      await waitForRedundancyKeys('some')

      await server2.videos.remove({ id: video.uuid })
      await waitJobs([ server1, server2 ])

      await waitForRedundancyKeys('none')
    })
  })

  describe('When switching object storage', function () {
    before(async function () {
      this.timeout(120000)

      await secondary.kill()

      const { uuid } = await server2.videos.quickUpload({ name: 'video 2 server 2' })
      await waitJobs([ server1, server2 ])

      video = await server2.videos.get({ id: uuid })

      await server1.redundancy.addVideo({ videoId: (await server1.videos.get({ id: video.uuid })).id })
      await waitForRedundancyBaseUrls(server1, 1)
      await waitJobs([ server1, server2 ])
    })

    it('Should remove the redundancies in object storage when object storage is disabled', async function () {
      this.timeout(120000)

      await server1.kill()
      await server1.run(redundancyConfig)

      await waitForRedundancyBaseUrls(server1, 0)
      await waitJobs([ server1, server2 ])

      expect(await getRedundancyBaseUrls(server2)).to.have.lengthOf(0)
    })

    it('Should duplicate the video on the file system', async function () {
      this.timeout(120000)

      await server1.redundancy.addVideo({ videoId: (await server1.videos.get({ id: video.uuid })).id })

      const [ baseUrl ] = await waitForRedundancyBaseUrls(server1, 1)
      expect(baseUrl).to.equal(server1.url + '/static/redundancy/hls/' + video.uuid)

      expect(await pathExists(join(server1.getDirectoryPath('redundancy/hls'), video.uuid))).to.be.true
    })

    it('Should remove the redundancies on the file system when object storage is enabled', async function () {
      this.timeout(120000)

      await server1.kill()
      await server1.run(getObjectStorageConfig())

      await waitForRedundancyBaseUrls(server1, 0)
      await waitJobs([ server1, server2 ])

      expect(await getRedundancyBaseUrls(server2)).to.have.lengthOf(0)
      expect(await pathExists(join(server1.getDirectoryPath('redundancy/hls'), video.uuid))).to.be.false
    })
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests([ secondary, server1, server2 ])
  })
})
