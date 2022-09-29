/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { prepareViewsServers, prepareViewsVideos, processViewersStats } from '@server/tests/shared'
import { cleanupTests, PeerTubeServer } from '@shared/server-commands'

describe('Test views retention stats', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await prepareViewsServers()
  })

  describe('Test retention stats on VOD', function () {
    let vodVideoId: string

    before(async function () {
      this.timeout(120000);

      ({ vodVideoId } = await prepareViewsVideos({ servers, live: false, vod: true }))
    })

    it('Should display empty retention', async function () {
      const { data } = await servers[0].videoStats.getRetentionStats({ videoId: vodVideoId })
      expect(data).to.have.lengthOf(6)

      for (let i = 0; i < 6; i++) {
        expect(data[i].second).to.equal(i)
        expect(data[i].retentionPercent).to.equal(0)
      }
    })

    it('Should display appropriate retention metrics', async function () {
      await servers[0].views.simulateViewer({ xForwardedFor: '127.0.0.2,127.0.0.1', id: vodVideoId, currentTimes: [ 0, 1 ] })
      await servers[0].views.simulateViewer({ xForwardedFor: '127.0.0.3,127.0.0.1', id: vodVideoId, currentTimes: [ 1, 3 ] })
      await servers[1].views.simulateViewer({ xForwardedFor: '127.0.0.2,127.0.0.1', id: vodVideoId, currentTimes: [ 4 ] })
      await servers[1].views.simulateViewer({ xForwardedFor: '127.0.0.3,127.0.0.1', id: vodVideoId, currentTimes: [ 0, 1 ] })

      await processViewersStats(servers)

      const { data } = await servers[0].videoStats.getRetentionStats({ videoId: vodVideoId })
      expect(data).to.have.lengthOf(6)

      expect(data.map(d => d.retentionPercent)).to.deep.equal([ 50, 75, 25, 25, 25, 0 ])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
