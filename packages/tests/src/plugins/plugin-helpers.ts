/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { HttpStatusCode, ThumbnailType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  makePostBodyRequest,
  makeRawRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkVideoFilesWereRemoved } from '@tests/shared/videos.js'

function postCommand (server: PeerTubeServer, command: string, bodyArg?: object) {
  const body = { command }
  if (bodyArg) Object.assign(body, bodyArg)

  return makePostBodyRequest({
    url: server.url,
    path: '/plugins/test-four/router/commander',
    fields: body,
    expectedStatus: HttpStatusCode.NO_CONTENT_204
  })
}

describe('Test plugin helpers', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath('-four') })
  })

  describe('Logger', function () {

    it('Should have logged things', async function () {
      await servers[0].servers.waitUntilLog(servers[0].host + ' peertube-plugin-test-four', 1, false)
      await servers[0].servers.waitUntilLog('Hello world from plugin four', 1)
    })
  })

  describe('Database', function () {

    it('Should have made a query', async function () {
      await servers[0].servers.waitUntilLog(`root email is admin${servers[0].internalServerNumber}@example.com`)
    })
  })

  describe('Config', function () {

    it('Should have the correct webserver url', async function () {
      await servers[0].servers.waitUntilLog(`server url is ${servers[0].url}`)
    })

    it('Should have the correct listening config', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/server-listening-config',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.config).to.exist
      expect(res.body.config.hostname).to.equal('::')
      expect(res.body.config.port).to.equal(servers[0].port)
    })

    it('Should have the correct config', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/server-config',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.serverConfig).to.exist
      expect(res.body.serverConfig.instance.name).to.equal('PeerTube')
    })
  })

  describe('Server', function () {

    it('Should get the server actor', async function () {
      await servers[0].servers.waitUntilLog('server actor name is peertube')
    })
  })

  describe('Socket', function () {

    it('Should sendNotification without any exceptions', async () => {
      const user = await servers[0].users.create({ username: 'notis_redding', password: 'secret1234?' })
      await makePostBodyRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/send-notification',
        fields: {
          userId: user.id
        },
        expectedStatus: HttpStatusCode.CREATED_201
      })
    })

    it('Should sendVideoLiveNewState without any exceptions', async () => {
      const res = await servers[0].videos.quickUpload({ name: 'video server 1' })

      await makePostBodyRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/send-video-live-new-state/' + res.uuid,
        expectedStatus: HttpStatusCode.CREATED_201
      })

      await servers[0].videos.remove({ id: res.uuid })
    })
  })

  describe('Plugin', function () {

    it('Should get the base static route', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/static-route',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.staticRoute).to.equal('/plugins/test-four/0.0.1/static/')
    })

    it('Should get the base static route', async function () {
      const baseRouter = '/plugins/test-four/0.0.1/router/'

      const res = await makeGetRequest({
        url: servers[0].url,
        path: baseRouter + 'router-route',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.routerRoute).to.equal(baseRouter)
    })
  })

  describe('User', function () {
    let rootId: number

    it('Should not get a user if not authenticated', async function () {
      await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/user',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should get a user if authenticated', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        token: servers[0].accessToken,
        path: '/plugins/test-four/router/user',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.username).to.equal('root')
      expect(res.body.displayName).to.equal('root')
      expect(res.body.isAdmin).to.be.true
      expect(res.body.isModerator).to.be.false
      expect(res.body.isUser).to.be.false

      rootId = res.body.id
    })

    it('Should load a user by id', async function () {
      {
        const res = await makeGetRequest({
          url: servers[0].url,
          path: '/plugins/test-four/router/user/' + rootId,
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(res.body.username).to.equal('root')
      }

      {
        await makeGetRequest({
          url: servers[0].url,
          path: '/plugins/test-four/router/user/42',
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      }
    })
  })

  describe('Moderation', function () {
    let videoUUIDServer1: string

    before(async function () {
      this.timeout(60000)

      {
        const res = await servers[0].videos.quickUpload({ name: 'video server 1' })
        videoUUIDServer1 = res.uuid
      }

      {
        await servers[1].videos.quickUpload({ name: 'video server 2' })
      }

      await waitJobs(servers)

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(2)
    })

    it('Should mute server 2', async function () {
      await postCommand(servers[0], 'blockServer', { hostToBlock: servers[1].host })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('video server 1')
    })

    it('Should unmute server 2', async function () {
      await postCommand(servers[0], 'unblockServer', { hostToUnblock: servers[1].host })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(2)
    })

    it('Should mute account of server 2', async function () {
      await postCommand(servers[0], 'blockAccount', { handleToBlock: `root@${servers[1].host}` })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('video server 1')
    })

    it('Should unmute account of server 2', async function () {
      await postCommand(servers[0], 'unblockAccount', { handleToUnblock: `root@${servers[1].host}` })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(2)
    })

    it('Should blacklist video', async function () {
      await postCommand(servers[0], 'blacklist', { videoUUID: videoUUIDServer1, unfederate: true })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        expect(data).to.have.lengthOf(1)
        expect(data[0].name).to.equal('video server 2')
      }
    })

    it('Should unblacklist video', async function () {
      await postCommand(servers[0], 'unblacklist', { videoUUID: videoUUIDServer1 })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        expect(data).to.have.lengthOf(2)
      }
    })
  })

  describe('Videos', function () {
    let videoUUID: string
    let videoPath: string

    before(async function () {
      this.timeout(240000)

      await servers[0].config.enableTranscoding({ webVideo: true, hls: true, resolutions: 'max' })

      const res = await servers[0].videos.quickUpload({ name: 'video1' })
      videoUUID = res.uuid

      await waitJobs(servers)
    })

    it('Should get video files', async function () {
      const { body } = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/video-files/' + videoUUID,
        expectedStatus: HttpStatusCode.OK_200
      })

      // Video files check
      {
        expect(body.webVideo.videoFiles).to.be.an('array')
        expect(body.hls.videoFiles).to.be.an('array')

        for (const resolution of [ 144, 240, 360, 480, 720 ]) {
          for (const files of [ body.webVideo.videoFiles, body.hls.videoFiles ]) {
            const file = files.find(f => f.resolution === resolution)
            expect(file).to.exist

            expect(file.size).to.be.a('number')
            expect(file.fps).to.equal(25)

            expect(await pathExists(file.path)).to.be.true
            await makeRawRequest({ url: file.url, expectedStatus: HttpStatusCode.OK_200 })
          }
        }

        videoPath = body.webVideo.videoFiles[0].path
      }

      // Thumbnails check
      {
        expect(body.thumbnails).to.be.an('array')

        const miniature = body.thumbnails.find(t => t.type === ThumbnailType.MINIATURE)
        expect(miniature).to.exist
        expect(await pathExists(miniature.path)).to.be.true
        await makeRawRequest({ url: miniature.url, expectedStatus: HttpStatusCode.OK_200 })

        const preview = body.thumbnails.find(t => t.type === ThumbnailType.PREVIEW)
        expect(preview).to.exist
        expect(await pathExists(preview.path)).to.be.true
        await makeRawRequest({ url: preview.url, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should probe a file', async function () {
      const { body } = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/ffprobe',
        query: {
          path: videoPath
        },
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(body.streams).to.be.an('array')
      expect(body.streams).to.have.lengthOf(2)
    })

    it('Should remove a video after a view', async function () {
      this.timeout(40000)

      // Should not throw -> video exists
      const video = await servers[0].videos.get({ id: videoUUID })
      // Should delete the video
      await servers[0].views.simulateView({ id: videoUUID })

      await servers[0].servers.waitUntilLog('Video deleted by plugin four.')

      try {
        // Should throw because the video should have been deleted
        await servers[0].videos.get({ id: videoUUID })
        throw new Error('Video exists')
      } catch (err) {
        if (err.message.includes('exists')) throw err
      }

      await checkVideoFilesWereRemoved({ server: servers[0], video })
    })

    it('Should have fetched the video by URL', async function () {
      await servers[0].servers.waitUntilLog(`video from DB uuid is ${videoUUID}`)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
