/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test the processes listed by the debug endpoint', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  let primary: PeerTubeServer
  let secondary1: PeerTubeServer
  let secondary2: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    await objectStorage.prepareDefaultMockBuckets()

    primary = await createSingleServer(1, objectStorage.getDefaultMockConfig())
    await setAccessTokensToServers([ primary ])

    secondary1 = await createSecondaryServer(primary)
    secondary2 = await createSecondaryServer(primary, { listen: { port: primary.port + 10001 } })
  })

  it('Should list the primary and the secondaries', async function () {
    const { serverVersion } = await primary.config.getConfig()
    const { secondariesUp, processes } = await primary.debug.getDebug()

    expect(secondariesUp).to.equal(2)
    expect(processes).to.have.lengthOf(3)

    expect(processes.map(p => p.role)).to.deep.equal([ 'primary', 'secondary', 'secondary' ])
    expect(processes.map(p => p.pid)).to.have.members([ primary.app.pid, secondary1.app.pid, secondary2.app.pid ])
    expect(new Set(processes.map(p => p.id)).size).to.equal(3)

    for (const p of processes) {
      expect(p.hostname).to.be.a('string').and.not.be.empty
      expect(p.version).to.equal(serverVersion)
      expect(new Date(p.startedAt).getTime()).to.be.at.most(new Date(p.lastSeenAt).getTime())
      expect(Date.now() - new Date(p.lastSeenAt).getTime()).to.be.below(10000)
    }
  })

  it('Should refresh the heartbeat of the processes', async function () {
    this.timeout(30000)

    const { processes: before } = await primary.debug.getDebug()

    await wait(5000)

    const { processes: after } = await primary.debug.getDebug()

    for (const p of after) {
      const previous = before.find(b => b.id === p.id)

      expect(p.startedAt).to.equal(previous.startedAt)
      expect(new Date(p.lastSeenAt).getTime()).to.be.above(new Date(previous.lastSeenAt).getTime())
    }
  })

  it('Should immediately stop listing a secondary that gracefully stopped', async function () {
    this.timeout(60000)

    const pid = secondary2.app.pid
    await secondary2.kill()

    const { secondariesUp, processes } = await primary.debug.getDebug()

    expect(secondariesUp).to.equal(1)
    expect(processes.map(p => p.pid)).to.not.include(pid)
  })

  it('Should stop listing a crashed secondary after it missed its heartbeats', async function () {
    this.timeout(60000)

    const app = secondary1.app

    await new Promise<void>(res => {
      app.once('exit', () => res())
      app.kill('SIGKILL')
    })

    // Stale after 3 heartbeat intervals of 2 seconds
    await wait(8000)

    const { secondariesUp, processes } = await primary.debug.getDebug()

    expect(secondariesUp).to.equal(0)
    expect(processes.map(p => p.role)).to.deep.equal([ 'primary' ])
  })

  it('Should list a secondary started again', async function () {
    this.timeout(60000)

    secondary1 = await createSecondaryServer(primary)

    const { secondariesUp, processes } = await primary.debug.getDebug()

    expect(secondariesUp).to.equal(1)
    expect(processes.find(p => p.role === 'secondary').pid).to.equal(secondary1.app.pid)
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests([ secondary1, secondary2, primary ])
  })
})
