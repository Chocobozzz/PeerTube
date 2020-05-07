/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  checkVideoFilesWereRemoved,
  doubleFollow,
  getPluginTestPath,
  getVideo,
  installPlugin,
  makePostBodyRequest,
  setAccessTokensToServers,
  uploadVideoAndGetId,
  viewVideo,
  getVideosList,
  waitJobs
} from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunMultipleServers, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'
import { expect } from 'chai'

function postCommand (server: ServerInfo, command: string, bodyArg?: object) {
  const body = { command }
  if (bodyArg) Object.assign(body, bodyArg)

  return makePostBodyRequest({
    url: server.url,
    path: '/plugins/test-four/router/commander',
    fields: body,
    statusCodeExpected: 204
  })
}

describe('Test plugin helpers', function () {
  let servers: ServerInfo[]

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath('-four')
    })
  })

  describe('Logger', function () {

    it('Should have logged things', async function () {
      await waitUntilLog(servers[0], 'localhost:' + servers[0].port + ' peertube-plugin-test-four', 1, false)
      await waitUntilLog(servers[0], 'Hello world from plugin four', 1)
    })
  })

  describe('Database', function () {

    it('Should have made a query', async function () {
      await waitUntilLog(servers[0], `root email is admin${servers[0].internalServerNumber}@example.com`)
    })
  })

  describe('Config', function () {

    it('Should have the correct webserver url', async function () {
      await waitUntilLog(servers[0], `server url is http://localhost:${servers[0].port}`)
    })
  })

  describe('Server', function () {

    it('Should get the server actor', async function () {
      await waitUntilLog(servers[0], 'server actor name is peertube')
    })
  })

  describe('Moderation', function () {
    let videoUUIDServer1: string

    before(async function () {
      this.timeout(15000)

      {
        const res = await uploadVideoAndGetId({ server: servers[0], videoName: 'video server 1' })
        videoUUIDServer1 = res.uuid
      }

      {
        await uploadVideoAndGetId({ server: servers[1], videoName: 'video server 2' })
      }

      await waitJobs(servers)

      const res = await getVideosList(servers[0].url)
      const videos = res.body.data

      expect(videos).to.have.lengthOf(2)
    })

    it('Should mute server 2', async function () {
      this.timeout(10000)
      await postCommand(servers[0], 'blockServer', { hostToBlock: `localhost:${servers[1].port}` })

      const res = await getVideosList(servers[0].url)
      const videos = res.body.data

      expect(videos).to.have.lengthOf(1)
      expect(videos[0].name).to.equal('video server 1')
    })

    it('Should unmute server 2', async function () {
      await postCommand(servers[0], 'unblockServer', { hostToUnblock: `localhost:${servers[1].port}` })

      const res = await getVideosList(servers[0].url)
      const videos = res.body.data

      expect(videos).to.have.lengthOf(2)
    })

    it('Should mute account of server 2', async function () {
      await postCommand(servers[0], 'blockAccount', { handleToBlock: `root@localhost:${servers[1].port}` })

      const res = await getVideosList(servers[0].url)
      const videos = res.body.data

      expect(videos).to.have.lengthOf(1)
      expect(videos[0].name).to.equal('video server 1')
    })

    it('Should unmute account of server 2', async function () {
      await postCommand(servers[0], 'unblockAccount', { handleToUnblock: `root@localhost:${servers[1].port}` })

      const res = await getVideosList(servers[0].url)
      const videos = res.body.data

      expect(videos).to.have.lengthOf(2)
    })

    it('Should blacklist video', async function () {
      this.timeout(10000)

      await postCommand(servers[0], 'blacklist', { videoUUID: videoUUIDServer1, unfederate: true })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        const videos = res.body.data

        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('video server 2')
      }
    })

    it('Should unblacklist video', async function () {
      this.timeout(10000)

      await postCommand(servers[0], 'unblacklist', { videoUUID: videoUUIDServer1 })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        const videos = res.body.data

        expect(videos).to.have.lengthOf(2)
      }
    })
  })

  describe('Videos', function () {
    let videoUUID: string

    before(async () => {
      const res = await uploadVideoAndGetId({ server: servers[0], videoName: 'video1' })
      videoUUID = res.uuid
    })

    it('Should remove a video after a view', async function () {
      this.timeout(20000)

      // Should not throw -> video exists
      await getVideo(servers[0].url, videoUUID)
      // Should delete the video
      await viewVideo(servers[0].url, videoUUID)

      await waitUntilLog(servers[0], 'Video deleted by plugin four.')

      try {
        // Should throw because the video should have been deleted
        await getVideo(servers[0].url, videoUUID)
        throw new Error('Video exists')
      } catch (err) {
        if (err.message.includes('exists')) throw err
      }

      await checkVideoFilesWereRemoved(videoUUID, servers[0].internalServerNumber)
    })

    it('Should have fetched the video by URL', async function () {
      await waitUntilLog(servers[0], `video from DB uuid is ${videoUUID}`)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
