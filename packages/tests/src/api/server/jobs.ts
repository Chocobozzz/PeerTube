/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { dateIsValid } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test jobs', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should create some jobs', async function () {
    this.timeout(240000)

    await servers[1].videos.upload({ attributes: { name: 'video1' } })
    await servers[1].videos.upload({ attributes: { name: 'video2' } })

    await waitJobs(servers)
  })

  it('Should list jobs', async function () {
    const body = await servers[1].jobs.list({ state: 'completed' })
    expect(body.total).to.be.above(2)
    expect(body.data).to.have.length.above(2)
  })

  it('Should list jobs with sort, pagination and job type', async function () {
    {
      const body = await servers[1].jobs.list({
        state: 'completed',
        start: 1,
        count: 2,
        sort: 'createdAt'
      })
      expect(body.total).to.be.above(2)
      expect(body.data).to.have.lengthOf(2)

      let job = body.data[0]
      // Skip repeat jobs
      if (job.type === 'videos-views-stats') job = body.data[1]

      expect(job.state).to.equal('completed')
      expect(dateIsValid(job.createdAt as string)).to.be.true
      expect(dateIsValid(job.processedOn as string)).to.be.true
      expect(dateIsValid(job.finishedOn as string)).to.be.true
    }

    {
      const body = await servers[1].jobs.list({
        state: 'completed',
        start: 0,
        count: 100,
        sort: 'createdAt',
        jobType: 'activitypub-http-broadcast'
      })
      expect(body.total).to.be.above(2)

      for (const j of body.data) {
        expect(j.type).to.equal('activitypub-http-broadcast')
      }
    }
  })

  it('Should list all jobs', async function () {
    const body = await servers[1].jobs.list()
    expect(body.total).to.be.above(2)

    const jobs = body.data
    expect(jobs).to.have.length.above(2)

    expect(jobs.find(j => j.state === 'completed')).to.not.be.undefined
  })

  it('Should pause the job queue', async function () {
    this.timeout(120000)

    const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video2' } })
    await waitJobs(servers)

    await servers[1].jobs.pauseJobQueue()
    await servers[1].videos.runTranscoding({ videoId: uuid, transcodingType: 'hls' })

    await wait(5000)

    {
      const body = await servers[1].jobs.list({ state: 'waiting', jobType: 'video-transcoding' })
      // root transcoding
      expect(body.data).to.have.lengthOf(1)
    }

    {
      const body = await servers[1].jobs.list({ state: 'waiting-children', jobType: 'transcoding-job-builder' })
      // next transcoding jobs
      expect(body.data).to.have.lengthOf(1)
    }
  })

  it('Should resume the job queue', async function () {
    this.timeout(120000)

    await servers[1].jobs.resumeJobQueue()

    await waitJobs(servers)

    const body = await servers[1].jobs.list({ state: 'waiting', jobType: 'video-transcoding' })
    expect(body.data).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
