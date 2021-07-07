/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { listVideoRedundancies, updateRedundancy } from '@shared/extra-utils/server/redundancy'
import { VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  flushAndRunServer,
  follow,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  waitUntilLog
} from '../../../../shared/extra-utils'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'

const expect = chai.expect

describe('Test redundancy constraints', function () {
  let remoteServer: ServerInfo
  let localServer: ServerInfo
  let servers: ServerInfo[]

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
    const res = await uploadVideo(localServer.url, localServer.accessToken, { name: 'to transcode', privacy: VideoPrivacy.PRIVATE })
    await waitJobs([ localServer ])

    // Update video to schedule a federation
    await updateVideo(localServer.url, localServer.accessToken, res.body.video.id, { name: videoName, privacy: VideoPrivacy.PUBLIC })
  }

  async function getTotalRedundanciesLocalServer () {
    const res = await listVideoRedundancies({
      url: localServer.url,
      accessToken: localServer.accessToken,
      target: 'my-videos'
    })

    return res.body.total
  }

  async function getTotalRedundanciesRemoteServer () {
    const res = await listVideoRedundancies({
      url: remoteServer.url,
      accessToken: remoteServer.accessToken,
      target: 'remote-videos'
    })

    return res.body.total
  }

  before(async function () {
    this.timeout(120000)

    {
      remoteServer = await flushAndRunServer(1, remoteServerConfig)
    }

    {
      const config = {
        remote_redundancy: {
          videos: {
            accept_from: 'nobody'
          }
        }
      }
      localServer = await flushAndRunServer(2, config)
    }

    servers = [ remoteServer, localServer ]

    // Get the access tokens
    await setAccessTokensToServers(servers)

    await uploadVideo(localServer.url, localServer.accessToken, { name: 'video 1 server 2' })

    await waitJobs(servers)

    // Server 1 and server 2 follow each other
    await follow(remoteServer.url, [ localServer.url ], remoteServer.accessToken)
    await waitJobs(servers)
    await updateRedundancy(remoteServer.url, remoteServer.accessToken, localServer.host, true)

    await waitJobs(servers)
  })

  it('Should have redundancy on server 1 but not on server 2 with a nobody filter', async function () {
    this.timeout(120000)

    await waitJobs(servers)
    await waitUntilLog(remoteServer, 'Duplicated ', 5)
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
    await reRunServer(localServer, config)

    await uploadWrapper('video 2 server 2')

    await waitUntilLog(remoteServer, 'Duplicated ', 10)
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
    await reRunServer(localServer, config)

    await uploadWrapper('video 3 server 2')

    await waitUntilLog(remoteServer, 'Duplicated ', 15)
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

    await follow(localServer.url, [ remoteServer.url ], localServer.accessToken)
    await waitJobs(servers)

    await uploadWrapper('video 4 server 2')
    await waitUntilLog(remoteServer, 'Duplicated ', 20)
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
