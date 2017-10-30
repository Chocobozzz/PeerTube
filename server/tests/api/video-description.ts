/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'

import {
  flushAndRunMultipleServers,
  flushTests,
  getVideo,
  getVideosList,
  killallServers,
  makeFriends,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait,
  getVideoDescription
} from '../utils'

const expect = chai.expect

describe('Test video description', function () {
  let servers: ServerInfo[] = []
  let videoUUID = ''
  let longDescription = 'my super description for pod 1'.repeat(50)

  before(async function () {
    this.timeout(10000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Pod 1 makes friend with pod 2
    await makeFriends(servers[0].url, servers[0].accessToken)
  })

  it('Should upload video with long description', async function () {
    this.timeout(15000)

    const attributes = {
      description: longDescription
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, attributes)

    await wait(11000)

    const res = await getVideosList(servers[0].url)

    videoUUID = res.body.data[0].uuid
  })

  it('Should have a truncated description on each pod', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video = res.body

      // 30 characters * 6 -> 240 characters
      const truncatedDescription = 'my super description for pod 1'.repeat(8) +
                                   'my supe...'

      expect(video.description).to.equal(truncatedDescription)
    }
  })

  it('Should fetch long description on each pod', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video = res.body

      const res2 = await getVideoDescription(server.url, video.descriptionPath)
      expect(res2.body.description).to.equal(longDescription)
    }
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
