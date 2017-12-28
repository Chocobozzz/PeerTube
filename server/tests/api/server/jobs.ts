/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushTests, killallServers, ServerInfo, setAccessTokensToServers, wait } from '../../utils/index'
import { doubleFollow } from '../../utils/server/follows'
import { getJobsList, getJobsListPaginationAndSort } from '../../utils/server/jobs'
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

    await wait(15000)
  })

  it('Should list jobs', async function () {
    const res = await getJobsList(servers[1].url, servers[1].accessToken)
    expect(res.body.total).to.be.above(2)
    expect(res.body.data).to.have.length.above(2)
  })

  it('Should list jobs with sort and pagination', async function () {
    const res = await getJobsListPaginationAndSort(servers[1].url, servers[1].accessToken, 4, 1, 'createdAt')
    expect(res.body.total).to.be.above(2)
    expect(res.body.data).to.have.lengthOf(1)

    const job = res.body.data[0]
    expect(job.state).to.equal('success')
    expect(job.category).to.equal('transcoding')
    expect(job.handlerName).to.have.length.above(3)
    expect(dateIsValid(job.createdAt)).to.be.true
    expect(dateIsValid(job.updatedAt)).to.be.true
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
