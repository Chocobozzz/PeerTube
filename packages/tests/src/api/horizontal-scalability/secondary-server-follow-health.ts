/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  doubleFollow,
  killallServers,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test follow health tracked by a secondary server process', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  let primary: PeerTubeServer
  let secondary: PeerTubeServer
  let remote: PeerTubeServer

  let videoUUID: string

  async function getRemoteFollowerScore () {
    const { data } = await primary.follows.getFollowers({ start: 0, count: 5, sort: 'createdAt' })

    return data.find(f => f.follower.host === remote.host).score
  }

  async function waitForScoreChange (previousScore: number) {
    for (let i = 0; i < 20; i++) {
      const score = await getRemoteFollowerScore()
      if (score !== previousScore) return score

      await wait(500)
    }

    return previousScore
  }

  before(async function () {
    this.timeout(120000)

    await objectStorage.prepareDefaultMockBuckets()

    primary = await createSingleServer(1, objectStorage.getDefaultMockConfig())
    remote = await createSingleServer(2)

    await setAccessTokensToServers([ primary, remote ])
    await setDefaultVideoChannel([ primary, remote ])

    secondary = await createSecondaryServer(primary)

    await doubleFollow(primary, remote)

    videoUUID = (await primary.videos.quickUpload({ name: 'video' })).uuid
    await waitJobs([ primary, remote ])

    // Only the secondary sends activities
    await primary.jobs.pauseJobQueue({ processRoles: [ 'primary' ] })
  })

  it('Should apply the bonus of a broadcast sent by the secondary', async function () {
    this.timeout(60000)

    const previousScore = await getRemoteFollowerScore()

    await primary.comments.createThread({ videoId: videoUUID, text: 'comment 1' })

    const score = await waitForScoreChange(previousScore)
    expect(score).to.be.above(previousScore)
  })

  it('Should apply the penalty of a broadcast sent by the secondary', async function () {
    this.timeout(60000)

    await killallServers([ remote ])

    const previousScore = await getRemoteFollowerScore()

    await primary.comments.createThread({ videoId: videoUUID, text: 'comment 2' })

    const score = await waitForScoreChange(previousScore)
    expect(score).to.be.below(previousScore)
  })

  it('Should send to a bad inbox of the secondary broadcast in a dedicated job', async function () {
    this.timeout(60000)

    await primary.comments.createThread({ videoId: videoUUID, text: 'comment 3' })

    for (let i = 0; i < 20; i++) {
      const { data } = await primary.jobs.listFailed({ jobType: 'activitypub-http-unicast' })
      if (data.some(j => j.data.uri === remote.url + '/inbox')) return

      await wait(500)
    }

    expect.fail('No failed unicast job to the inbox of the remote server')
  })

  after(async function () {
    await primary?.jobs.resumeJobQueue({ processRoles: [ 'primary' ] })

    await objectStorage.cleanupMock()

    await cleanupTests([ secondary, primary, remote ])
  })
})
