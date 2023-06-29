/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { cleanupTests, createSingleServer, PeerTubeServer } from '@shared/server-commands'

describe('Test videos overview API validator', function () {
  let server: PeerTubeServer

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
  })

  describe('When getting videos overview', function () {

    it('Should fail with a bad pagination', async function () {
      await server.overviews.getVideos({ page: 0, expectedStatus: 400 })
      await server.overviews.getVideos({ page: 100, expectedStatus: 400 })
    })

    it('Should succeed with a good pagination', async function () {
      await server.overviews.getVideos({ page: 1 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
