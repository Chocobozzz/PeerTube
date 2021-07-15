/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { cleanupTests, doubleFollow, flushAndRunMultipleServers, ServerInfo, setAccessTokensToServers, waitJobs } from '@shared/extra-utils'

const expect = chai.expect

describe('Test video description', function () {
  let servers: ServerInfo[] = []
  let videoUUID = ''
  let videoId: number
  const longDescription = 'my super description for server 1'.repeat(50)

  before(async function () {
    this.timeout(40000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload video with long description', async function () {
    this.timeout(10000)

    const attributes = {
      description: longDescription
    }
    await servers[0].videosCommand.upload({ attributes })

    await waitJobs(servers)

    const { data } = await servers[0].videosCommand.list()

    videoId = data[0].id
    videoUUID = data[0].uuid
  })

  it('Should have a truncated description on each server', async function () {
    for (const server of servers) {
      const video = await server.videosCommand.get({ id: videoUUID })

      // 30 characters * 6 -> 240 characters
      const truncatedDescription = 'my super description for server 1'.repeat(7) +
        'my super descrip...'

      expect(video.description).to.equal(truncatedDescription)
    }
  })

  it('Should fetch long description on each server', async function () {
    for (const server of servers) {
      const video = await server.videosCommand.get({ id: videoUUID })

      const { description } = await server.videosCommand.getDescription({ descriptionPath: video.descriptionPath })
      expect(description).to.equal(longDescription)
    }
  })

  it('Should update with a short description', async function () {
    this.timeout(10000)

    const attributes = {
      description: 'short description'
    }
    await servers[0].videosCommand.update({ id: videoId, attributes })

    await waitJobs(servers)
  })

  it('Should have a small description on each server', async function () {
    for (const server of servers) {
      const video = await server.videosCommand.get({ id: videoUUID })

      expect(video.description).to.equal('short description')

      const { description } = await server.videosCommand.getDescription({ descriptionPath: video.descriptionPath })
      expect(description).to.equal('short description')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
