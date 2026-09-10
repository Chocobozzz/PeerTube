/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { cleanupTests, createSecondaryServer, PeerTubeServer } from '@peertube/peertube-server-commands'
import { prepareViewsServers, prepareViewsVideos, processViewersStats, processViewsBuffer } from '@tests/shared/views.js'
import { expect } from 'chai'

describe('Test video views tracked by a secondary server process', function () {
  let primary: PeerTubeServer
  let secondary: PeerTubeServer
  let vodVideoId: string

  before(async function () {
    this.timeout(120000)

    const servers = await prepareViewsServers({ singleServer: true })
    primary = servers[0]

    const { vodVideoId: uuid } = await prepareViewsVideos({ servers, vod: true, live: false })
    vodVideoId = uuid

    secondary = await createSecondaryServer(primary)
  })

  it('Should not count a view when the watch time is below the threshold', async function () {
    this.timeout(60000)

    await secondary.views.simulateViewer({ id: vodVideoId, currentTimes: [ 1, 2 ] })

    // The buffer is only flushed by the primary
    await processViewsBuffer([ primary ])

    const video = await primary.videos.get({ id: vodVideoId })
    expect(video.views).to.equal(0)
  })

  it('Should count a view registered on the secondary', async function () {
    this.timeout(60000)

    await secondary.views.simulateViewer({ id: vodVideoId, currentTimes: [ 1, 4 ] })

    await processViewsBuffer([ primary ])

    const video = await primary.videos.get({ id: vodVideoId })
    expect(video.views).to.equal(1)
  })

  it('Should share the view de-duplication between both processes', async function () {
    this.timeout(60000)

    // Same viewer, this time through the primary: it must not be counted twice
    await primary.views.simulateViewer({ id: vodVideoId, currentTimes: [ 1, 4 ] })

    await processViewsBuffer([ primary ])

    const video = await primary.videos.get({ id: vodVideoId })
    expect(video.views).to.equal(1)
  })

  it('Should not lose watch sections when the heartbeats of a session alternate between processes', async function () {
    this.timeout(60000)

    const video = await primary.videos.quickUpload({ name: 'alternating viewer' })
    const sessionId = 'alternating-viewer-session'

    await primary.views.view({ id: video.uuid, sessionId, currentTime: 0, viewEvent: 'seek' })
    await secondary.views.view({ id: video.uuid, sessionId, currentTime: 1 })
    await primary.views.view({ id: video.uuid, sessionId, currentTime: 2 })
    await secondary.views.view({ id: video.uuid, sessionId, currentTime: 3 })
    await primary.views.view({ id: video.uuid, sessionId, currentTime: 4 })

    await processViewersStats([ primary ])

    const { data } = await primary.videoStats.getRetentionStats({ videoId: video.uuid })

    expect(data.map(d => d.retentionPercent)).to.deep.equal([ 100, 100, 100, 100, 100, 0 ])
  })

  it('Should report the same view count from both processes', async function () {
    const fromPrimary = await primary.videos.get({ id: vodVideoId })
    const fromSecondary = await secondary.videos.get({ id: vodVideoId })

    expect(fromSecondary.views).to.equal(fromPrimary.views)
  })

  after(async function () {
    await cleanupTests([ secondary, primary ])
  })
})
