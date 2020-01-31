/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  getVideo,
  getVideoDescription,
  getVideosList,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo
} from '../../../../shared/extra-utils/index'
import { doubleFollow } from '../../../../shared/extra-utils/server/follows'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'

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
    await uploadVideo(servers[0].url, servers[0].accessToken, attributes)

    await waitJobs(servers)

    const res = await getVideosList(servers[0].url)

    videoId = res.body.data[0].id
    videoUUID = res.body.data[0].uuid
  })

  it('Should have a truncated description on each server', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video = res.body

      // 30 characters * 6 -> 240 characters
      const truncatedDescription = 'my super description for server 1'.repeat(7) +
        'my super descrip...'

      expect(video.description).to.equal(truncatedDescription)
    }
  })

  it('Should fetch long description on each server', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video = res.body

      const res2 = await getVideoDescription(server.url, video.descriptionPath)
      expect(res2.body.description).to.equal(longDescription)
    }
  })

  it('Should update with a short description', async function () {
    this.timeout(10000)

    const attributes = {
      description: 'short description'
    }
    await updateVideo(servers[0].url, servers[0].accessToken, videoId, attributes)

    await waitJobs(servers)
  })

  it('Should have a small description on each server', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video = res.body

      expect(video.description).to.equal('short description')

      const res2 = await getVideoDescription(server.url, video.descriptionPath)
      expect(res2.body.description).to.equal('short description')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
