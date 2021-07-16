/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import {
  checkVideoFilesWereRemoved,
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  makeGetRequest,
  makePostBodyRequest,
  PluginsCommand,
  ServerInfo,
  setAccessTokensToServers,
  waitJobs
} from '@shared/extra-utils'

function postCommand (server: ServerInfo, command: string, bodyArg?: object) {
  const body = { command }
  if (bodyArg) Object.assign(body, bodyArg)

  return makePostBodyRequest({
    url: server.url,
    path: '/plugins/test-four/router/commander',
    fields: body,
    statusCodeExpected: HttpStatusCode.NO_CONTENT_204
  })
}

describe('Test plugin helpers', function () {
  let servers: ServerInfo[]

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath('-four') })
  })

  describe('Logger', function () {

    it('Should have logged things', async function () {
      await servers[0].servers.waitUntilLog('localhost:' + servers[0].port + ' peertube-plugin-test-four', 1, false)
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
      await servers[0].servers.waitUntilLog(`server url is http://localhost:${servers[0].port}`)
    })

    it('Should have the correct config', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/server-config',
        statusCodeExpected: HttpStatusCode.OK_200
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

  describe('Plugin', function () {

    it('Should get the base static route', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/static-route',
        statusCodeExpected: HttpStatusCode.OK_200
      })

      expect(res.body.staticRoute).to.equal('/plugins/test-four/0.0.1/static/')
    })

    it('Should get the base static route', async function () {
      const baseRouter = '/plugins/test-four/0.0.1/router/'

      const res = await makeGetRequest({
        url: servers[0].url,
        path: baseRouter + 'router-route',
        statusCodeExpected: HttpStatusCode.OK_200
      })

      expect(res.body.routerRoute).to.equal(baseRouter)
    })
  })

  describe('User', function () {

    it('Should not get a user if not authenticated', async function () {
      await makeGetRequest({
        url: servers[0].url,
        path: '/plugins/test-four/router/user',
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should get a user if authenticated', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        token: servers[0].accessToken,
        path: '/plugins/test-four/router/user',
        statusCodeExpected: HttpStatusCode.OK_200
      })

      expect(res.body.username).to.equal('root')
      expect(res.body.displayName).to.equal('root')
      expect(res.body.isAdmin).to.be.true
      expect(res.body.isModerator).to.be.false
      expect(res.body.isUser).to.be.false
    })
  })

  describe('Moderation', function () {
    let videoUUIDServer1: string

    before(async function () {
      this.timeout(60000)

      {
        const res = await await servers[0].videos.quickUpload({ name: 'video server 1' })
        videoUUIDServer1 = res.uuid
      }

      {
        await await servers[1].videos.quickUpload({ name: 'video server 2' })
      }

      await waitJobs(servers)

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(2)
    })

    it('Should mute server 2', async function () {
      this.timeout(10000)
      await postCommand(servers[0], 'blockServer', { hostToBlock: `localhost:${servers[1].port}` })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('video server 1')
    })

    it('Should unmute server 2', async function () {
      await postCommand(servers[0], 'unblockServer', { hostToUnblock: `localhost:${servers[1].port}` })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(2)
    })

    it('Should mute account of server 2', async function () {
      await postCommand(servers[0], 'blockAccount', { handleToBlock: `root@localhost:${servers[1].port}` })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('video server 1')
    })

    it('Should unmute account of server 2', async function () {
      await postCommand(servers[0], 'unblockAccount', { handleToUnblock: `root@localhost:${servers[1].port}` })

      const { data } = await servers[0].videos.list()

      expect(data).to.have.lengthOf(2)
    })

    it('Should blacklist video', async function () {
      this.timeout(10000)

      await postCommand(servers[0], 'blacklist', { videoUUID: videoUUIDServer1, unfederate: true })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        expect(data).to.have.lengthOf(1)
        expect(data[0].name).to.equal('video server 2')
      }
    })

    it('Should unblacklist video', async function () {
      this.timeout(10000)

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

    before(async () => {
      const res = await await servers[0].videos.quickUpload({ name: 'video1' })
      videoUUID = res.uuid
    })

    it('Should remove a video after a view', async function () {
      this.timeout(40000)

      // Should not throw -> video exists
      await servers[0].videos.get({ id: videoUUID })
      // Should delete the video
      await servers[0].videos.view({ id: videoUUID })

      await servers[0].servers.waitUntilLog('Video deleted by plugin four.')

      try {
        // Should throw because the video should have been deleted
        await servers[0].videos.get({ id: videoUUID })
        throw new Error('Video exists')
      } catch (err) {
        if (err.message.includes('exists')) throw err
      }

      await checkVideoFilesWereRemoved(videoUUID, servers[0])
    })

    it('Should have fetched the video by URL', async function () {
      await servers[0].servers.waitUntilLog(`video from DB uuid is ${videoUUID}`)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
