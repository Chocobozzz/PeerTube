/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { Job } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test slow follows', function () {
  let servers: PeerTubeServer[] = []

  let afterFollows: Date

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])
    await doubleFollow(servers[0], servers[2])

    afterFollows = new Date()

    for (let i = 0; i < 5; i++) {
      await servers[0].videos.quickUpload({ name: 'video ' + i })
    }

    await waitJobs(servers)
  })

  it('Should only have broadcast jobs', async function () {
    const { data } = await servers[0].jobs.list({ jobType: 'activitypub-http-unicast', sort: '-createdAt' })

    for (const job of data) {
      expect(new Date(job.createdAt)).below(afterFollows)
    }
  })

  it('Should process bad follower', async function () {
    this.timeout(30000)

    await servers[1].kill()

    // Set server 2 as bad follower
    await servers[0].videos.quickUpload({ name: 'video 6' })
    await waitJobs(servers[0])

    afterFollows = new Date()
    const filter = (job: Job) => new Date(job.createdAt) > afterFollows

    // Resend another broadcast job
    await servers[0].videos.quickUpload({ name: 'video 7' })
    await waitJobs(servers[0])

    const resBroadcast = await servers[0].jobs.list({ jobType: 'activitypub-http-broadcast', sort: '-createdAt' })
    const resUnicast = await servers[0].jobs.list({ jobType: 'activitypub-http-unicast', sort: '-createdAt' })

    const broadcast = resBroadcast.data.filter(filter)
    const unicast = resUnicast.data.filter(filter)

    expect(unicast).to.have.lengthOf(2)
    expect(broadcast).to.have.lengthOf(2)

    for (const u of unicast) {
      expect(u.data.uri).to.equal(servers[1].url + '/inbox')
    }

    for (const b of broadcast) {
      expect(b.data.uris).to.have.lengthOf(1)
      expect(b.data.uris[0]).to.equal(servers[2].url + '/inbox')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
