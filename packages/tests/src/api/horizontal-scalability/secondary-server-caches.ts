/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { ActorImageType, HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test the caches shared by the processes of a platform', function () {
  let primary: PeerTubeServer
  let secondary: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    primary = await createSingleServer(1)

    await setAccessTokensToServers([ primary ])
    await setDefaultVideoChannel([ primary ])

    secondary = await createSecondaryServer(primary)
  })

  describe('Model cache', function () {
    it('Should stop serving a video the primary deleted, even after the secondary cached it', async function () {
      const { uuid } = await primary.videos.quickUpload({ name: 'video to delete' })

      const viewPath = '/api/v1/videos/' + uuid + '/views'

      // Puts the immutable attributes of the video in the model cache of the secondary
      await makePutBodyRequest({
        url: secondary.url,
        path: viewPath,
        fields: { currentTime: 1 },
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })

      await primary.videos.remove({ id: uuid })

      await makePutBodyRequest({
        url: secondary.url,
        path: viewPath,
        fields: { currentTime: 1 },
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should serve the new instance avatar after the primary changed it', async function () {
      this.timeout(60000)

      {
        const config = await secondary.config.getConfig()
        expect(config.instance.avatars).to.have.lengthOf(0)
      }

      await primary.config.updateInstanceImage({ fixture: 'avatar.png', type: ActorImageType.AVATAR })

      {
        const config = await secondary.config.getConfig()
        expect(config.instance.avatars).to.not.have.lengthOf(0)
      }
    })
  })

  after(async function () {
    await cleanupTests([ secondary, primary ])
  })
})
