/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test video description', function () {
  let servers: PeerTubeServer[] = []
  let videoUUID = ''
  let videoId: number
  const longDescription = 'my super description for server 1'.repeat(50)

  before(async function () {
    this.timeout(40000)

    // Run servers
    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload video with long description', async function () {
    this.timeout(30000)

    const attributes = {
      description: longDescription
    }
    await servers[0].videos.upload({ attributes })

    await waitJobs(servers)

    const { data } = await servers[0].videos.list()

    videoId = data[0].id
    videoUUID = data[0].uuid
  })

  it('Should have a truncated description on each server', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })

      // 30 characters * 6 -> 240 characters
      const truncatedDescription = 'my super description for server 1'.repeat(7) +
        'my super descrip...'

      expect(video.description).to.equal(truncatedDescription)
    }
  })

  it('Should fetch long description on each server', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })

      const { description } = await server.videos.getDescription({ descriptionPath: video.descriptionPath })
      expect(description).to.equal(longDescription)
    }
  })

  it('Should update with a short description', async function () {
    this.timeout(10000)

    const attributes = {
      description: 'short description'
    }
    await servers[0].videos.update({ id: videoId, attributes })

    await waitJobs(servers)
  })

  it('Should have a small description on each server', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })

      expect(video.description).to.equal('short description')

      const { description } = await server.videos.getDescription({ descriptionPath: video.descriptionPath })
      expect(description).to.equal('short description')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
