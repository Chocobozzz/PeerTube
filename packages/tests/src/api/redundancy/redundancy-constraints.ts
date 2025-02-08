/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test redundancy constraints', function () {
  let remoteServer: PeerTubeServer
  let localServer: PeerTubeServer
  let servers: PeerTubeServer[]

  const remoteServerConfig = {
    redundancy: {
      videos: {
        check_interval: '1 second',
        strategies: [
          {
            strategy: 'recently-added',
            min_lifetime: '1 hour',
            size: '100MB',
            min_views: 0
          }
        ]
      }
    }
  }

  async function uploadWrapper (videoName: string) {
    // Wait for transcoding
    const { id } = await localServer.videos.upload({ attributes: { name: 'to transcode', privacy: VideoPrivacy.PRIVATE } })
    await waitJobs([ localServer ])

    // Update video to schedule a federation
    await localServer.videos.update({ id, attributes: { name: videoName, privacy: VideoPrivacy.PUBLIC } })
  }

  async function getTotalRedundanciesLocalServer () {
    const body = await localServer.redundancy.listVideos({ target: 'my-videos' })

    return body.total
  }

  async function getTotalRedundanciesRemoteServer () {
    const body = await remoteServer.redundancy.listVideos({ target: 'remote-videos' })

    return body.total
  }

  before(async function () {
    this.timeout(120000)

    {
      remoteServer = await createSingleServer(1, remoteServerConfig)
    }

    {
      const config = {
        remote_redundancy: {
          videos: {
            accept_from: 'nobody'
          }
        }
      }
      localServer = await createSingleServer(2, config)
    }

    servers = [ remoteServer, localServer ]

    // Get the access tokens
    await setAccessTokensToServers(servers)

    await localServer.videos.upload({ attributes: { name: 'video 1 server 2' } })

    await waitJobs(servers)

    // Server 1 and server 2 follow each other
    await remoteServer.follows.follow({ hosts: [ localServer.url ] })
    await waitJobs(servers)
    await remoteServer.redundancy.updateRedundancy({ host: localServer.host, redundancyAllowed: true })

    await waitJobs(servers)
  })

  it('Should have redundancy on server 1 but not on server 2 with a nobody filter', async function () {
    this.timeout(120000)

    await waitJobs(servers)
    await remoteServer.servers.waitUntilLog('Duplicated playlist ', 1)
    await waitJobs(servers)

    {
      const total = await getTotalRedundanciesRemoteServer()
      expect(total).to.equal(1)
    }

    {
      const total = await getTotalRedundanciesLocalServer()
      expect(total).to.equal(0)
    }
  })

  it('Should have redundancy on server 1 and on server 2 with an anybody filter', async function () {
    this.timeout(120000)

    const config = {
      remote_redundancy: {
        videos: {
          accept_from: 'anybody'
        }
      }
    }
    await killallServers([ localServer ])
    await localServer.run(config)

    await uploadWrapper('video 2 server 2')

    await remoteServer.servers.waitUntilLog('Duplicated playlist ', 2)
    await waitJobs(servers)

    {
      const total = await getTotalRedundanciesRemoteServer()
      expect(total).to.equal(2)
    }

    {
      const total = await getTotalRedundanciesLocalServer()
      expect(total).to.equal(1)
    }
  })

  it('Should have redundancy on server 1 but not on server 2 with a followings filter', async function () {
    this.timeout(120000)

    const config = {
      remote_redundancy: {
        videos: {
          accept_from: 'followings'
        }
      }
    }
    await killallServers([ localServer ])
    await localServer.run(config)

    await uploadWrapper('video 3 server 2')

    await remoteServer.servers.waitUntilLog('Duplicated playlist ', 3)
    await waitJobs(servers)

    {
      const total = await getTotalRedundanciesRemoteServer()
      expect(total).to.equal(3)
    }

    {
      const total = await getTotalRedundanciesLocalServer()
      expect(total).to.equal(1)
    }
  })

  it('Should have redundancy on server 1 and on server 2 with followings filter now server 2 follows server 1', async function () {
    this.timeout(120000)

    await localServer.follows.follow({ hosts: [ remoteServer.url ] })
    await waitJobs(servers)

    await uploadWrapper('video 4 server 2')
    await remoteServer.servers.waitUntilLog('Duplicated playlist ', 4)
    await waitJobs(servers)

    {
      const total = await getTotalRedundanciesRemoteServer()
      expect(total).to.equal(4)
    }

    {
      const total = await getTotalRedundanciesLocalServer()
      expect(total).to.equal(2)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
