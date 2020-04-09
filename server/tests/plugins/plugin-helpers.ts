/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'
import {
  checkVideoFilesWereRemoved,
  getPluginTestPath,
  getVideo,
  installPlugin,
  setAccessTokensToServers,
  uploadVideoAndGetId,
  viewVideo
} from '../../../shared/extra-utils'

describe('Test plugin helpers', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-four')
    })
  })

  it('Should have logged things', async function () {
    await waitUntilLog(server, 'localhost:' + server.port + ' peertube-plugin-test-four', 1, false)
    await waitUntilLog(server, 'Hello world from plugin four', 1)
  })

  it('Should have made a query', async function () {
    await waitUntilLog(server, `root email is admin${server.internalServerNumber}@example.com`, 1)
  })

  it('Should remove a video after a view', async function () {
    this.timeout(20000)

    const videoUUID = (await uploadVideoAndGetId({ server: server, videoName: 'video1' })).uuid

    // Should not throw -> video exists
    await getVideo(server.url, videoUUID)
    // Should delete the video
    await viewVideo(server.url, videoUUID)

    await waitUntilLog(server, 'Video deleted by plugin four.', 1)

    try {
      // Should throw because the video should have been deleted
      await getVideo(server.url, videoUUID)
      throw new Error('Video exists')
    } catch (err) {
      if (err.message.includes('exists')) throw err
    }

    await checkVideoFilesWereRemoved(videoUUID, server.internalServerNumber)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
