/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */


import { HttpStatusCode } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'

describe('Test rate limit disabling', function () {
  let server: PeerTubeServer

  async function restartWithConfig (max: number) {
    if (server) await cleanupTests([ server ])

    const config = {
      rates_limit: {
        api: {
          max,
          window: 5000
        }
      }
    }

    server = await createSingleServer(1, config)
    await setAccessTokensToServers([ server ])
  }

  after(async function () {
    await cleanupTests([ server ])
  })

  it('Should rate limit API calls when max > 0', async function () {
    this.timeout(60000)

    await restartWithConfig(2)

    await server.videos.list({ expectedStatus: HttpStatusCode.OK_200 })
    await server.videos.list({ expectedStatus: HttpStatusCode.OK_200 })
    await server.videos.list({ expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
  })

  it('Should NOT rate limit API calls when max <= 0', async function () {
    this.timeout(60000)

    await restartWithConfig(0)

    for (let i = 0; i < 10; i++) {
      await server.videos.list({ expectedStatus: HttpStatusCode.OK_200 })
    }
  })
})
