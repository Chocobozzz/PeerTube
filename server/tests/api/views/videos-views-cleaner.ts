/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { SQLCommand } from '@server/tests/shared'
import { wait } from '@shared/core-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test video views cleaner', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[] = []

  let videoIdServer1: string
  let videoIdServer2: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    videoIdServer1 = (await servers[0].videos.quickUpload({ name: 'video server 1' })).uuid
    videoIdServer2 = (await servers[1].videos.quickUpload({ name: 'video server 2' })).uuid

    await waitJobs(servers)

    await servers[0].views.simulateView({ id: videoIdServer1 })
    await servers[1].views.simulateView({ id: videoIdServer1 })
    await servers[0].views.simulateView({ id: videoIdServer2 })
    await servers[1].views.simulateView({ id: videoIdServer2 })

    await waitJobs(servers)

    sqlCommands = servers.map(s => new SQLCommand(s))
  })

  it('Should not clean old video views', async function () {
    this.timeout(50000)

    await killallServers([ servers[0] ])

    await servers[0].run({ views: { videos: { remote: { max_age: '10 days' } } } })

    await wait(6000)

    // Should still have views

    for (let i = 0; i < servers.length; i++) {
      const total = await sqlCommands[i].countVideoViewsOf(videoIdServer1)
      expect(total).to.equal(2, 'Server ' + servers[i].serverNumber + ' does not have the correct amount of views')
    }

    for (let i = 0; i < servers.length; i++) {
      const total = await sqlCommands[i].countVideoViewsOf(videoIdServer2)
      expect(total).to.equal(2, 'Server ' + servers[i].serverNumber + ' does not have the correct amount of views')
    }
  })

  it('Should clean old video views', async function () {
    this.timeout(50000)

    await killallServers([ servers[0] ])

    await servers[0].run({ views: { videos: { remote: { max_age: '5 seconds' } } } })

    await wait(6000)

    // Should still have views

    for (let i = 0; i < servers.length; i++) {
      const total = await sqlCommands[i].countVideoViewsOf(videoIdServer1)
      expect(total).to.equal(2)
    }

    const totalServer1 = await sqlCommands[0].countVideoViewsOf(videoIdServer2)
    expect(totalServer1).to.equal(0)

    const totalServer2 = await sqlCommands[1].countVideoViewsOf(videoIdServer2)
    expect(totalServer2).to.equal(2)
  })

  after(async function () {
    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
})
