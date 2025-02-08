/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { PeerTubeServer, cleanupTests } from '@peertube/peertube-server-commands'
import { prepareViewsServers, prepareViewsVideos, processViewersStats } from '@tests/shared/views.js'
import { expect } from 'chai'

describe('Test views retention stats', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await prepareViewsServers()
  })

  describe('Test retention stats on VOD', function () {
    let vodVideoId: string

    function runTests (options: { useSessionId: boolean }) {

      const sessionField = options.useSessionId
        ? 'sessionId'
        : 'xForwardedFor'

      before(async function () {
        this.timeout(240000);

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
        await servers[0].views.simulateViewer({ [sessionField]: '127-0-0-2-127-0-0-1', id: vodVideoId, currentTimes: [ 0, 1 ] })
        await servers[0].views.simulateViewer({ [sessionField]: '127-0-0-3-127-0-0-1', id: vodVideoId, currentTimes: [ 1, 3 ] })
        await servers[1].views.simulateViewer({ [sessionField]: '127-0-0-2-127-0-0-1', id: vodVideoId, currentTimes: [ 3, 4 ] })
        await servers[1].views.simulateViewer({ [sessionField]: '127-0-0-3-127-0-0-1', id: vodVideoId, currentTimes: [ 0, 1 ] })

        // Do not take into account empty section
        await servers[1].views.simulateViewer({ [sessionField]: '127-0-0-3-127-0-0-1', id: vodVideoId, currentTimes: [ 5, 5 ] })
        await servers[0].views.simulateViewer({ [sessionField]: '127-0-0-4-127-0-0-1', id: vodVideoId, currentTimes: [ 1, 1 ] })
        await servers[1].views.simulateViewer({ [sessionField]: '127-0-0-4-127-0-0-1', id: vodVideoId, currentTimes: [ 1, 1 ] })

        await processViewersStats(servers)

        const { data } = await servers[0].videoStats.getRetentionStats({ videoId: vodVideoId })
        expect(data).to.have.lengthOf(6)

        expect(data.map(d => d.retentionPercent)).to.deep.equal([ 50, 75, 25, 50, 25, 0 ])
      })

      it('Should display appropriate retention metrics after a server restart', async function () {
        this.timeout(240000)

        const newVideo = await servers[0].videos.quickUpload({ name: 'video 2' })

        await servers[0].views.simulateViewer({ [sessionField]: '127-0-0-2-127-0-0-1', id: newVideo.id, currentTimes: [ 0, 1 ] })
        await servers[0].views.simulateViewer({ [sessionField]: '127-0-0-3-127-0-0-1', id: newVideo.id, currentTimes: [ 1, 3 ] })

        await wait(2500)

        await servers[0].kill()

        await servers[0].run()

        await processViewersStats(servers)

        const { data } = await servers[0].videoStats.getRetentionStats({ videoId: newVideo.id })
        expect(data).to.have.lengthOf(6)

        expect(data.map(d => d.retentionPercent)).to.deep.equal([ 50, 100, 50, 50, 0, 0 ])
      })
    }

    describe('Not using session id', function () {
      runTests({ useSessionId: false })
    })

    describe('Using session id', function () {
      runTests({ useSessionId: true })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
