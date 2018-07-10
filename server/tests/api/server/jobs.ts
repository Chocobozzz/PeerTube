/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { killallServers, ServerInfo, setAccessTokensToServers } from '../../utils/index'
import { doubleFollow } from '../../utils/server/follows'
import { getJobsList, getJobsListPaginationAndSort, waitJobs } from '../../utils/server/jobs'
import { flushAndRunMultipleServers } from '../../utils/server/servers'
import { uploadVideo } from '../../utils/videos/videos'
import { dateIsValid } from '../../utils/miscs/miscs'

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
    this.timeout(30000)

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
    const res = await getJobsListPaginationAndSort(servers[1].url, servers[1].accessToken, 'completed', 1, 1, 'createdAt')
    expect(res.body.total).to.be.above(2)
    expect(res.body.data).to.have.lengthOf(1)

    const job = res.body.data[0]

    expect(job.state).to.equal('completed')
    expect(job.type).to.equal('activitypub-http-unicast')
    expect(dateIsValid(job.createdAt)).to.be.true
    expect(dateIsValid(job.processedOn)).to.be.true
    expect(dateIsValid(job.finishedOn)).to.be.true
  })

  after(async function () {
    killallServers(servers)
  })
})
