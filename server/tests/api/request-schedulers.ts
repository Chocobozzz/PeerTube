/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  uploadVideo,
  makeFriends,
  wait,
  setAccessTokensToServers,
  flushAndRunMultipleServers
} from '../utils'

describe('Test requests schedulers stats', function () {
  const requestSchedulerNames = [ 'requestScheduler', 'requestVideoQaduScheduler', 'requestVideoEventScheduler' ]
  const path = '/api/v1/request-schedulers/stats'
  let servers: ServerInfo[] = []

  function uploadVideoWrapper (server: ServerInfo) {
    const videoAttributes = {
      tags: [ 'tag1', 'tag2' ]
    }

    return uploadVideo(server.url, server.accessToken, videoAttributes)
  }

  function getRequestsStats (server: ServerInfo) {
    return request(server.url)
            .get(path)
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer ' + server.accessToken)
            .expect(200)
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    await makeFriends(servers[0].url, servers[0].accessToken)
  })

  it('Should have a correct timer', async function () {
    const server = servers[0]

    const res = await getRequestsStats(server)

    const requestSchedulers = res.body
    for (const requestSchedulerName of requestSchedulerNames) {
      const requestScheduler = requestSchedulers[requestSchedulerName]

      expect(requestScheduler.remainingMilliSeconds).to.be.at.least(0)
      expect(requestScheduler.remainingMilliSeconds).to.be.at.most(10000)
    }
  })

  it('Should have the correct total request', async function () {
    this.timeout(15000)

    const server = servers[0]
    // Ensure the requests of pod 1 won't be made
    servers[1].app.kill()

    await uploadVideoWrapper(server)

    await wait(1000)

    const res = await getRequestsStats(server)
    const requestSchedulers = res.body
    const requestScheduler = requestSchedulers.requestScheduler
    expect(requestScheduler.totalRequests).to.equal(1)
  })

  after(async function () {
    process.kill(-servers[0].app.pid)

    if (this['ok']) {
      await flushTests()
    }
  })
})
