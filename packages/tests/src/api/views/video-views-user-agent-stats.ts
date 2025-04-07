/* eslint-disable @typescript-eslint/no-unused-expressions */
import { buildUUID } from '@peertube/peertube-node-utils'
import { PeerTubeServer, cleanupTests, waitJobs } from '@peertube/peertube-server-commands'
import { prepareViewsServers, processViewersStats } from '@tests/shared/views.js'
import { expect } from 'chai'

describe('Test views user agent stats', function () {
  let server: PeerTubeServer
  let beforeChromeView: Date
  let videoUUID: string

  before(async function () {
    this.timeout(120000)

    const servers = await prepareViewsServers({ singleServer: true })
    server = servers[0]

    const { uuid } = await server.videos.quickUpload({ name: 'video' })
    videoUUID = uuid
    await waitJobs(server)
  })

  it('Should report client, device and OS', async function () {
    this.timeout(240000)

    await server.views.simulateView({
      id: videoUUID,
      sessionId: buildUUID(),
      client: 'Edge',
      device: 'desktop',
      operatingSystem: 'Android'
    })
    await server.views.simulateView({
      id: videoUUID,
      sessionId: buildUUID(),
      client: 'Edge',
      device: 'mobile',
      operatingSystem: 'Windows'
    })

    await processViewersStats([ server ])
    beforeChromeView = new Date()

    await server.views.simulateView({
      id: videoUUID,
      sessionId: buildUUID(),
      client: 'Chrome',
      device: 'desktop',
      operatingSystem: 'Ubuntu'
    })

    await processViewersStats([ server ])

    const stats = await server.videoStats.getUserAgentStats({ videoId: videoUUID })

    expect(stats.clients).to.include.deep.members([ { name: 'Chrome', viewers: 1 } ])
    expect(stats.clients).to.include.deep.members([ { name: 'Edge', viewers: 2 } ])

    expect(stats.devices).to.include.deep.members([ { name: 'desktop', viewers: 2 } ])
    expect(stats.devices).to.include.deep.members([ { name: 'mobile', viewers: 1 } ])

    expect(stats.operatingSystems).to.include.deep.members([ { name: 'Android', viewers: 1 } ])
    expect(stats.operatingSystems).to.include.deep.members([ { name: 'Ubuntu', viewers: 1 } ])
    expect(stats.operatingSystems).to.include.deep.members([ { name: 'Windows', viewers: 1 } ])
  })

  it('Should filter by date', async function () {
    {
      const stats = await server.videoStats.getUserAgentStats({ videoId: videoUUID, startDate: beforeChromeView.toISOString() })

      expect(stats.clients).to.include.deep.members([ { name: 'Chrome', viewers: 1 } ])
      expect(stats.clients.find(e => e.name === 'Edge')).to.not.exist
    }

    {
      const stats = await server.videoStats.getUserAgentStats({ videoId: videoUUID, endDate: beforeChromeView.toISOString() })

      expect(stats.clients.find(e => e.name === 'Chrome')).to.not.exist
      expect(stats.clients).to.include.deep.members([ { name: 'Edge', viewers: 2 } ])
    }
  })

  it('Should use a null value if device is not known by PeerTube', async function () {
    await server.views.simulateView({
      id: videoUUID,
      sessionId: buildUUID(),
      client: 'Chrome',
      device: 'unknown' as any,
      operatingSystem: 'Ubuntu'
    })

    await processViewersStats([ server ])

    const stats = await server.videoStats.getUserAgentStats({ videoId: videoUUID, endDate: beforeChromeView.toISOString() })
    expect(stats.devices.map(d => d.name)).to.deep.members([ 'desktop', 'mobile' ])
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
