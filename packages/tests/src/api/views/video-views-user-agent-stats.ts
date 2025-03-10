import { buildUUID } from '@peertube/peertube-node-utils'
import { PeerTubeServer, cleanupTests, waitJobs } from '@peertube/peertube-server-commands'
import { prepareViewsServers, processViewersStats } from '@tests/shared/views.js'
import { expect } from 'chai'

// eslint-disable-next-line max-len
const EDGE_WINDOWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/132.0.0.0'
// eslint-disable-next-line max-len
const EDGE_ANDROID_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.49 Mobile Safari/537.36 EdgA/131.0.2903.87'
const CHROME_LINUX_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'

describe('Test views user agent stats', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    const servers = await prepareViewsServers({ singleServer: true })
    server = servers[0]
  })

  it('Should report browser, device and OS', async function () {
    this.timeout(240000)

    const { uuid } = await server.videos.quickUpload({ name: 'video' })
    await waitJobs(server)

    await server.views.simulateView({
      id: uuid,
      sessionId: buildUUID(),
      userAgent: EDGE_ANDROID_USER_AGENT
    })
    await server.views.simulateView({
      id: uuid,
      sessionId: buildUUID(),
      userAgent: EDGE_WINDOWS_USER_AGENT
    })
    await server.views.simulateView({
      id: uuid,
      sessionId: buildUUID(),
      userAgent: CHROME_LINUX_USER_AGENT
    })

    await processViewersStats([ server ])

    const stats = await server.videoStats.getUserAgentStats({ videoId: uuid })

    expect(stats.browser).to.include.deep.members([ { name: 'Chrome', viewers: 1 } ])
    expect(stats.browser).to.include.deep.members([ { name: 'Edge', viewers: 2 } ])

    expect(stats.device).to.include.deep.members([ { name: 'unknown', viewers: 2 } ])
    expect(stats.device).to.include.deep.members([ { name: 'mobile', viewers: 1 } ])

    expect(stats.operatingSystem).to.include.deep.members([ { name: 'Android', viewers: 1 } ])
    expect(stats.operatingSystem).to.include.deep.members([ { name: 'Linux', viewers: 1 } ])
    expect(stats.operatingSystem).to.include.deep.members([ { name: 'Windows', viewers: 1 } ])
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
