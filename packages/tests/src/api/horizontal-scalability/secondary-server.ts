/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { HttpStatusCode } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test a secondary server process', function () {
  let primary: PeerTubeServer
  let secondary: PeerTubeServer
  let videoUUID: string
  let videoId: number
  let videoShortUUID: string

  before(async function () {
    this.timeout(120000)

    primary = await createSingleServer(1, {
      // Large enough for the requests of this suite, small enough for the shared counter test below to exhaust it quickly
      rates_limit: {
        api: {
          window: 60000,
          max: 200
        }
      }
    })

    await setAccessTokensToServers([ primary ])
    await setDefaultVideoChannel([ primary ])

    const { id, uuid, shortUUID } = await primary.videos.quickUpload({ name: 'video served by both processes' })
    videoUUID = uuid
    videoId = id
    videoShortUUID = shortUUID

    await primary.videos.quickUpload({ name: 'nsfw video', nsfw: true })

    secondary = await createSecondaryServer(primary)
  })

  describe('Process roles', function () {
    it('Should run both processes on different ports', function () {
      expect(secondary.port).to.not.equal(primary.port)
    })

    it('Should serve every endpoint of the secondary subset', async function () {
      const paths = [
        '/api/v1/videos',
        '/api/v1/videos/' + videoUUID,
        '/api/v1/videos/categories',
        '/api/v1/videos/licences',
        '/api/v1/videos/languages',
        '/api/v1/videos/privacies',
        '/api/v1/ping'
      ]

      for (const path of paths) {
        await makeGetRequest({ url: secondary.url, path, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should not serve the endpoints the primary owns', async function () {
      for (const path of [ '/api/v1/users', '/api/v1/config', '/api/v1/jobs', '/api/v1/search/videos' ]) {
        await makeGetRequest({ url: secondary.url, path, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }
    })

    it('Should still answer the ping of the secondary', async function () {
      await makeGetRequest({ url: secondary.url, path: '/api/v1/ping', expectedStatus: HttpStatusCode.OK_200 })

      await makePostBodyRequest({
        url: secondary.url,
        path: '/api/v1/ping',
        fields: {},
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('Read endpoints', function () {
    it('Should list the videos of the instance', async function () {
      const primaryList = await primary.videos.list()
      const secondaryList = await secondary.videos.list()

      expect(secondaryList.total).to.equal(primaryList.total)
      expect(secondaryList.data.map(v => v.uuid)).to.deep.equal(primaryList.data.map(v => v.uuid))
    })

    it('Should get a video of the instance', async function () {
      const fromPrimary = await primary.videos.get({ id: videoUUID })
      const fromSecondary = await secondary.videos.get({ id: videoUUID })

      expect(fromSecondary.uuid).to.equal(fromPrimary.uuid)
      expect(fromSecondary.name).to.equal(fromPrimary.name)

      // URLs are built from the public webserver host, which both processes share
      expect(fromSecondary.embedPath).to.equal(fromPrimary.embedPath)
      expect(fromSecondary.files.map(f => f.fileUrl)).to.deep.equal(fromPrimary.files.map(f => f.fileUrl))
    })

    it('Should return a 404 for an unknown video', async function () {
      await secondary.videos.get({ id: buildUUID(), expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should accept every form of video id', async function () {
      for (const id of [ videoId, videoUUID, videoShortUUID ]) {
        const video = await secondary.videos.get({ id })

        expect(video.uuid, `video fetched with "${id}"`).to.equal(videoUUID)
      }
    })

    it('Should accept an authenticated request', async function () {
      const token = primary.accessToken

      const fromPrimary = await primary.videos.list({ token })
      const fromSecondary = await secondary.videos.list({ token })

      expect(fromSecondary.total).to.equal(fromPrimary.total)
      expect(fromSecondary.data.map(v => v.uuid)).to.deep.equal(fromPrimary.data.map(v => v.uuid))
    })

    it('Should apply the pagination, sort and filter parameters of the list', async function () {
      const query = { start: 0, count: 1, sort: '-name' }

      const fromPrimary = await primary.videos.list(query)
      const fromSecondary = await secondary.videos.list(query)

      expect(fromSecondary.data).to.have.lengthOf(1)
      expect(fromSecondary.total).to.equal(fromPrimary.total)
      expect(fromSecondary.data[0].name).to.equal(fromPrimary.data[0].name)
    })
  })

  describe('Video constant endpoints', function () {
    it('Should serve the same video constants as the primary', async function () {
      for (const name of [ 'categories', 'licences', 'languages', 'privacies' ]) {
        const path = '/api/v1/videos/' + name

        const fromPrimary = await makeGetRequest({ url: primary.url, path, expectedStatus: HttpStatusCode.OK_200 })
        const fromSecondary = await makeGetRequest({ url: secondary.url, path, expectedStatus: HttpStatusCode.OK_200 })

        expect(Object.keys(fromSecondary.body), name).to.not.have.lengthOf(0)
        expect(fromSecondary.body, name).to.deep.equal(fromPrimary.body)
      }
    })

    it('Should apply the scope of the language list', async function () {
      const path = '/api/v1/videos/languages'

      const all = await makeGetRequest({ url: secondary.url, path, expectedStatus: HttpStatusCode.OK_200 })

      const subtitle = await makeGetRequest({
        url: secondary.url,
        path,
        query: { scope: 'subtitle' },
        expectedStatus: HttpStatusCode.OK_200
      })

      // Subtitle languages are the ones of the full list that carry text
      expect(Object.keys(subtitle.body).length).to.be.below(Object.keys(all.body).length)
    })
  })

  describe('View endpoints', function () {
    it('Should track a view with both accepted methods', async function () {
      for (const path of [ '/api/v1/videos/' + videoUUID + '/views', '/api/v1/videos/' + videoUUID + '/watching' ]) {
        const fields = { currentTime: 1 }

        await makePostBodyRequest({
          url: secondary.url,
          path,
          fields,
          token: primary.accessToken,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })

        await makePutBodyRequest({
          url: secondary.url,
          path,
          fields,
          token: primary.accessToken,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
      }
    })

    it('Should have updated the watch history of the user', async function () {
      const { data } = await primary.history.list()

      expect(data.map(v => v.uuid)).to.contain(videoUUID)
    })

    it('Should reject the methods the view endpoints do not accept', async function () {
      for (const path of [ '/api/v1/videos/' + videoUUID + '/views', '/api/v1/videos/' + videoUUID + '/watching' ]) {
        await makeGetRequest({ url: secondary.url, path, expectedStatus: HttpStatusCode.METHOD_NOT_ALLOWED_405 })
        await makeDeleteRequest({ url: secondary.url, path, expectedStatus: HttpStatusCode.METHOD_NOT_ALLOWED_405 })
      }
    })
  })

  describe('Runtime configuration changes', function () {
    it('Should apply on the secondary a configuration change made on the primary', async function () {
      this.timeout(60000)

      {
        const { data } = await secondary.videos.list({ token: null })
        expect(data.map(v => v.name)).to.contain('nsfw video')
      }

      await primary.config.updateExistingConfig({
        newConfig: { instance: { defaultNSFWPolicy: 'do_not_list' } }
      })

      await secondary.servers.waitUntilLog('Applying the configuration change published by the primary process.')

      {
        const { data } = await secondary.videos.list({ token: null })
        expect(data.map(v => v.name)).to.not.contain('nsfw video')
      }
    })
  })

  describe('Configuration encryption', function () {
    it('Should refuse to boot a secondary process that does not share the secret of the primary', async function () {
      this.timeout(60000)

      let started: PeerTubeServer
      let error: Error

      try {
        started = await createSecondaryServer(primary, {
          secrets: { peertube: 'not the secret of the primary' },
          // Another port, so a process that wrongly boots does not merely fail to bind the one of `secondary`
          listen: { port: primary.port + 20001 }
        })
      } catch (err) {
        error = err as Error
      }

      if (started) await started.kill()

      expect(error, 'the secondary process should not have started').to.exist
      expect(error.message).to.contain('cannot be decrypted')
    })
  })

  describe('Storage directories', function () {
    it('Should refuse to boot a process that shares a storage directory with another one', async function () {
      this.timeout(60000)

      let started: PeerTubeServer
      let error: Error

      try {
        started = await createSecondaryServer(primary, {
          // Already claimed by the primary
          storage: { plugins: primary.getDirectoryPath('plugins') + '/' },
          // Another port, so a process that wrongly boots does not merely fail to bind the one of `secondary`
          listen: { port: primary.port + 20002 }
        })
      } catch (err) {
        error = err as Error
      }

      if (started) await started.kill()

      expect(error, 'the secondary process should not have started').to.exist
      expect(error.message).to.contain('already belongs to another PeerTube process')
      expect(error.message, 'the error should name the setting to change').to.contain('storage.plugins')
    })

    // The tmp directory is emptied at every boot, so its owner marker is the one that could be wiped by mistake
    it('Should still refuse to boot on a shared tmp directory, which is cleaned at every boot', async function () {
      this.timeout(60000)

      let started: PeerTubeServer
      let error: Error

      try {
        started = await createSecondaryServer(primary, {
          storage: { tmp: primary.getDirectoryPath('tmp') + '/' },
          listen: { port: primary.port + 20003 }
        })
      } catch (err) {
        error = err as Error
      }

      if (started) await started.kill()

      expect(error, 'the secondary process should not have started').to.exist
      expect(error.message).to.contain('already belongs to another PeerTube process')
      expect(error.message, 'the error should name the setting to change').to.contain('storage.tmp')
    })
  })

  // Must stay last: it deliberately exhausts the rate limit budget of the instance
  describe('Shared rate limit', function () {
    it('Should count the requests of both processes in the same counter', async function () {
      this.timeout(60000)

      // Consume the budget on the primary only
      let rateLimited = false

      for (let i = 0; i < 500 && !rateLimited; i++) {
        const { status } = await makeGetRequest({ url: primary.url, path: '/api/v1/videos', expectedStatus: null })

        rateLimited = status === HttpStatusCode.TOO_MANY_REQUESTS_429
      }

      expect(rateLimited, 'the primary should have been rate limited').to.be.true

      // The secondary shares the counter
      await makeGetRequest({
        url: secondary.url,
        path: '/api/v1/videos',
        expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
      })
    })
  })

  after(async function () {
    await cleanupTests([ secondary, primary ])
  })
})
