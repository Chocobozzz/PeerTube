/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  flushTests,
  killallServers,
  flushAndRunServer,
  ServerInfo,
  setAccessTokensToServers,
  cleanupTests
} from '../../../../shared/extra-utils/index'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { uploadVideo } from '../../../../shared/extra-utils/videos/videos'
import { getLogs } from '../../../../shared/extra-utils/logs/logs'

const expect = chai.expect

describe('Test logs', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should get logs with a start date', async function () {
    this.timeout(10000)

    await uploadVideo(server.url, server.accessToken, { name: 'video 1' })
    await waitJobs([ server ])

    const now = new Date()

    await uploadVideo(server.url, server.accessToken, { name: 'video 2' })
    await waitJobs([ server ])

    const res = await getLogs(server.url, server.accessToken, now)
    const logsString = JSON.stringify(res.body)

    expect(logsString.includes('video 1')).to.be.false
    expect(logsString.includes('video 2')).to.be.true
  })

  it('Should get logs with an end date', async function () {
    this.timeout(10000)

    await uploadVideo(server.url, server.accessToken, { name: 'video 3' })
    await waitJobs([ server ])

    const now1 = new Date()

    await uploadVideo(server.url, server.accessToken, { name: 'video 4' })
    await waitJobs([ server ])

    const now2 = new Date()

    await uploadVideo(server.url, server.accessToken, { name: 'video 5' })
    await waitJobs([ server ])

    const res = await getLogs(server.url, server.accessToken, now1, now2)
    const logsString = JSON.stringify(res.body)

    expect(logsString.includes('video 3')).to.be.false
    expect(logsString.includes('video 4')).to.be.true
    expect(logsString.includes('video 5')).to.be.false
  })

  it('Should get filter by level', async function () {
    this.timeout(10000)

    const now = new Date()

    await uploadVideo(server.url, server.accessToken, { name: 'video 6' })
    await waitJobs([ server ])

    {
      const res = await getLogs(server.url, server.accessToken, now, undefined, 'info')
      const logsString = JSON.stringify(res.body)

      expect(logsString.includes('video 6')).to.be.true
    }

    {
      const res = await getLogs(server.url, server.accessToken, now, undefined, 'warn')
      const logsString = JSON.stringify(res.body)

      expect(logsString.includes('video 6')).to.be.false
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
