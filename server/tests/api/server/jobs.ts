/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { cleanupTests, killallServers, ServerInfo, setAccessTokensToServers } from '../../../../shared/extra-utils/index'
import { doubleFollow } from '../../../../shared/extra-utils/server/follows'
import { getJobsList, getJobsListPaginationAndSort, waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { flushAndRunMultipleServers } from '../../../../shared/extra-utils/server/servers'
import { uploadVideo } from '../../../../shared/extra-utils/videos/videos'
import { dateIsValid } from '../../../../shared/extra-utils/miscs/miscs'
import { Job } from '../../../../shared/models/server'

const expect = chai.expect

describe('Test jobs', function () {
  let servers: ServerInfo[]

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should create some jobs', async function () {
    this.timeout(60000)

    await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video1' })
    await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video2' })

    await waitJobs(servers)
  })

  it('Should list jobs', async function () {
    const res = await getJobsList(servers[1].url, servers[1].accessToken, 'completed')
    expect(res.body.total).to.be.above(2)
    expect(res.body.data).to.have.length.above(2)
  })

  it('Should list jobs with sort and pagination', async function () {
    const res = await getJobsListPaginationAndSort(servers[1].url, servers[1].accessToken, 'completed', 1, 2, 'createdAt')
    expect(res.body.total).to.be.above(2)
    expect(res.body.data).to.have.lengthOf(2)

    let job = res.body.data[0]
    // Skip repeat jobs
    if (job.type === 'videos-views') job = res.body.data[1]

    expect(job.state).to.equal('completed')
    expect(job.type.startsWith('activitypub-')).to.be.true
    expect(dateIsValid(job.createdAt)).to.be.true
    expect(dateIsValid(job.processedOn)).to.be.true
    expect(dateIsValid(job.finishedOn)).to.be.true
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
