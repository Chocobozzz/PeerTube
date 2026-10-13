/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { ActorImageType, HttpStatusCode } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makeGetRequest,
  makePutBodyRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test the caches shared by the processes of a platform', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  let primary: PeerTubeServer
  let secondary: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    await objectStorage.prepareDefaultMockBuckets()

    primary = await createSingleServer(1, objectStorage.getDefaultMockConfig())

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

      // The invalidation reaches the secondary asynchronously, but much sooner than the expiration of the model cache
      let status: number

      for (let i = 0; i < 20 && status !== HttpStatusCode.NOT_FOUND_404; i++) {
        if (i !== 0) await wait(250)

        const res = await makePutBodyRequest({ url: secondary.url, path: viewPath, fields: { currentTime: 1 }, expectedStatus: null })
        status = res.status
      }

      expect(status).to.equal(HttpStatusCode.NOT_FOUND_404)
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

  describe('API cache', function () {
    const feedPath = '/feeds/videos.xml'

    it('Should serve on the secondary a response the primary cached', async function () {
      {
        const res = await makeGetRequest({
          url: primary.url,
          path: feedPath,
          accept: 'application/xml',
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.headers['x-api-cache-cached']).to.not.exist
      }

      {
        const res = await makeGetRequest({
          url: secondary.url,
          path: feedPath,
          accept: 'application/xml',
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.headers['x-api-cache-cached']).to.equal('true')
      }
    })

    it('Should invalidate on the secondary a group the primary cleared', async function () {
      const { uuid } = await primary.videos.quickUpload({ name: 'video in the podcast feed' })

      const podcastPath = '/feeds/podcast/videos.xml?videoChannelId=' + primary.store.channel.id

      // Cache the podcast feed on the secondary
      await makeGetRequest({
        url: secondary.url,
        path: podcastPath,
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })

      // The primary owns the deletion, so it is the process that clears the group
      await primary.videos.remove({ id: uuid })

      const res = await makeGetRequest({
        url: secondary.url,
        path: podcastPath,
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.headers['x-api-cache-cached']).to.not.exist
      expect(res.text).to.not.contain(uuid)
    })
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests([ secondary, primary ])
  })
})
