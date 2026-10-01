/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { HttpStatusCode } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled, buildUUID } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { activityPubContextify, buildGlobalHTTPHeaders } from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { getPort, randomListen, terminateServer } from '@tests/shared/mock-servers/shared.js'
import { makePOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { processViewsBuffer } from '@tests/shared/views.js'
import { expect } from 'chai'
import express from 'express'
import { Server } from 'http'

describe('Test the inbox of a secondary server process', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  let primary: PeerTubeServer
  let secondary: PeerTubeServer
  let remote: PeerTubeServer

  let remoteSQL: SQLCommand

  let localVideo: { id: number, uuid: string }
  let remoteVideoUUID: string

  async function countInboxRequests (server: PeerTubeServer) {
    const content = await server.servers.getLogContent()

    return content.toString().match(new RegExp(`Receiving inbox requests for \\d+ activities by ${remote.url}`, 'g'))?.length ?? 0
  }

  async function sendActivity (
    activity: { type: 'View' | 'Download' | 'Announce', id: string, actor: string, object: string },
    servers: PeerTubeServer[]
  ) {
    const [ { privateKey } ] = await remoteSQL.selectQuery<{ privateKey: string }>(
      `SELECT "privateKey" FROM actor WHERE url = :url`,
      { url: activity.actor }
    )

    const httpSignature = {
      keyId: activity.actor,
      key: privateKey,
      headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD
    }

    for (const server of servers) {
      const body = await activityPubContextify(activity, activity.type, data => Promise.resolve(data))

      await makePOSTAPRequest(server.url + '/inbox', body, httpSignature, buildGlobalHTTPHeaders(body, buildDigest))
    }
  }

  async function sendToBothProcesses (activity: { type: 'View' | 'Download', id: string, actor: string, object: string }) {
    await sendActivity(activity, [ secondary, primary ])

    // Also waits for the activities in the inbox of the secondary
    await waitJobs([ primary, remote ])
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

    localVideo = await primary.videos.quickUpload({ name: 'local video' })
    await waitJobs([ primary, remote ])

    // The remote server now delivers its activities to the inbox of the secondary
    // Also prevent the remote server from refreshing these actors, that would restore their inbox URL
    remoteSQL = new SQLCommand(remote)
    await remoteSQL.updateQuery(
      `UPDATE actor SET ` +
        `"inboxUrl" = replace("inboxUrl", :primaryUrl, :secondaryUrl), ` +
        `"sharedInboxUrl" = replace("sharedInboxUrl", :primaryUrl, :secondaryUrl), ` +
        `"createdAt" = :future, "updatedAt" = :future ` +
        `WHERE url LIKE :primaryActors`,
      { primaryUrl: primary.url, secondaryUrl: secondary.url, future: '2100-01-01T00:00:00Z', primaryActors: primary.url + '/%' }
    )
  })

  it('Should process the creation of a remote video on the secondary', async function () {
    this.timeout(60000)

    const primaryInboxRequests = await countInboxRequests(primary)

    const { uuid } = await remote.videos.quickUpload({ name: 'remote video' })
    remoteVideoUUID = uuid

    await waitJobs([ primary, remote ])

    for (const server of [ primary, secondary ]) {
      const video = await server.videos.get({ id: remoteVideoUUID })

      expect(video.name).to.equal('remote video')
      expect(video.isLocal).to.be.false
    }

    expect(await countInboxRequests(secondary)).to.be.above(0)
    expect(await countInboxRequests(primary)).to.equal(primaryInboxRequests)
  })

  it('Should process the update of a remote video on the secondary', async function () {
    this.timeout(60000)

    await remote.videos.update({ id: remoteVideoUUID, attributes: { name: 'remote video updated' } })
    await waitJobs([ primary, remote ])

    const video = await primary.videos.get({ id: remoteVideoUUID })
    expect(video.name).to.equal('remote video updated')
  })

  it('Should count a view sent by the remote server to the secondary', async function () {
    this.timeout(60000)

    await remote.views.simulateViewer({ id: localVideo.uuid, currentTimes: [ 1, 4 ] })
    await waitJobs([ primary, remote ])

    await processViewsBuffer([ primary ])

    const video = await primary.videos.get({ id: localVideo.uuid })
    expect(video.views).to.equal(1)
  })

  it('Should share the de-duplication of remote views between processes', async function () {
    this.timeout(60000)

    const actor = remote.url + '/accounts/peertube'

    await sendToBothProcesses({
      type: 'View',
      id: actor + '/views/videos/' + localVideo.id + '/' + buildUUID(),
      actor,
      object: primary.url + '/videos/watch/' + localVideo.uuid
    })

    await processViewsBuffer([ primary ])

    const video = await primary.videos.get({ id: localVideo.uuid })
    expect(video.views).to.equal(2)
  })

  it('Should share the de-duplication of remote downloads between processes', async function () {
    this.timeout(60000)

    const actor = remote.url + '/accounts/peertube'

    await sendToBothProcesses({
      type: 'Download',
      id: actor + '/downloads/videos/' + localVideo.id + '/' + buildUUID(),
      actor,
      object: primary.url + '/videos/watch/' + localVideo.uuid
    })

    await processViewsBuffer([ primary ])

    const video = await primary.videos.get({ id: localVideo.uuid })
    expect(video.downloads).to.equal(1)
  })

  it('Should report the inbox stats of every process', async function () {
    for (const server of [ primary, secondary ]) {
      const stats = await server.stats.get()

      expect(stats.totalActivityPubAnnounceMessagesSuccesses).to.be.at.least(1)
      expect(stats.totalActivityPubViewMessagesSuccesses).to.be.at.least(3)
      expect(stats.totalActivityPubDownloadMessagesSuccesses).to.equal(2)

      expect(stats.totalActivityPubMessagesWaiting).to.equal(0)
    }
  })

  it('Should process the deletion of a remote video on the secondary', async function () {
    this.timeout(60000)

    await remote.videos.remove({ id: remoteVideoUUID })
    await waitJobs([ primary, remote ])

    await primary.videos.get({ id: remoteVideoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  describe('When stopping the secondary', function () {
    let slowServer: Server
    let slowServerUrl: string

    async function countProcessedAnnounces () {
      const stats = await primary.stats.get()

      return stats.totalActivityPubAnnounceMessagesSuccesses + stats.totalActivityPubAnnounceMessagesErrors
    }

    async function sendSlowAnnounces (count: number) {
      const actor = remote.url + '/accounts/peertube'

      for (let i = 0; i < count; i++) {
        await sendActivity({
          type: 'Announce',
          id: actor + '/announces/' + buildUUID(),
          actor,
          object: slowServerUrl + '/videos/watch/' + buildUUID()
        }, [ secondary ])
      }
    }

    before(async function () {
      const app = express()
      app.get('/*', (_req, res) => setTimeout(() => res.sendStatus(HttpStatusCode.NOT_FOUND_404), 3000))

      slowServer = await randomListen(app)
      slowServerUrl = 'http://127.0.0.1:' + getPort(slowServer)
    })

    it('Should process the activities received before stopping', async function () {
      this.timeout(60000)

      const processedBefore = await countProcessedAnnounces()

      await sendSlowAnnounces(4)
      await secondary.kill()

      expect(await countProcessedAnnounces()).to.equal(processedBefore + 4)

      const { activityPubMessagesWaiting } = await primary.debug.getDebug()
      expect(activityPubMessagesWaiting).to.equal(0)
    })

    it('Should drop the activities it cannot process before the timeout', async function () {
      this.timeout(120000)

      secondary = await createSecondaryServer(primary)

      const processedBefore = await countProcessedAnnounces()

      // 3 rounds of parallel processing: takes more than the 4 seconds of the inbox drain
      await sendSlowAnnounces(12)
      await secondary.kill()

      const processed = await countProcessedAnnounces() - processedBefore
      expect(processed).to.be.above(0)
      expect(processed).to.be.below(12)

      const logs = await secondary.servers.getLogContent()
      expect(logs.toString()).to.match(/Cannot process \d+ inbox messages in \d+ms before stopping, they are lost/)

      // The waiting count of the stopped process is removed
      const { activityPubMessagesWaiting } = await primary.debug.getDebug()
      expect(activityPubMessagesWaiting).to.equal(0)
    })

    after(async function () {
      await terminateServer(slowServer)
    })
  })

  after(async function () {
    await remoteSQL?.cleanup()

    await objectStorage.cleanupMock()

    await cleanupTests([ secondary, primary, remote ])
  })
})
