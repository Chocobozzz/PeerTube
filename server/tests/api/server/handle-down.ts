/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { completeVideoCheck, runServer, viewVideo } from '../../utils'

import {
  flushAndRunMultipleServers, flushTests, getVideosList, killallServers, ServerInfo, setAccessTokensToServers, uploadVideo,
  wait
} from '../../utils/index'
import { follow, getFollowersListPaginationAndSort } from '../../utils/server/follows'
import { getJobsListPaginationAndSort } from '../../utils/server/jobs'

const expect = chai.expect

describe('Test handle downs', function () {
  let servers: ServerInfo[] = []

  const videoAttributes = {
    name: 'my super name for server 1',
    category: 5,
    licence: 4,
    language: 9,
    nsfw: true,
    description: 'my super description for server 1',
    tags: [ 'tag1p1', 'tag2p1' ],
    fixture: 'video_short1.webm'
  }

  const checkAttributes = {
    name: 'my super name for server 1',
    category: 5,
    licence: 4,
    language: 9,
    nsfw: true,
    description: 'my super description for server 1',
    host: 'localhost:9001',
    account: 'root',
    isLocal: false,
    duration: 10,
    tags: [ 'tag1p1', 'tag2p1' ],
    privacy: VideoPrivacy.PUBLIC,
    commentsEnabled: true,
    channel: {
      name: 'Default root channel',
      description: '',
      isLocal: false
    },
    fixture: 'video_short1.webm',
    files: [
      {
        resolution: 720,
        size: 572456
      }
    ]
  }

  before(async function () {
    this.timeout(20000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  it('Should remove followers that are often down', async function () {
    this.timeout(60000)

    await follow(servers[1].url, [ servers[0].url ], servers[1].accessToken)

    await wait(5000)

    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await wait(5000)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
    }

    // Kill server 1
    killallServers([ servers[1] ])

    // Remove server 2 follower
    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, videoAttributes)
    }

    await wait(10000)

    const res = await getFollowersListPaginationAndSort(servers[0].url, 0, 1, 'createdAt')
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should not have pending/processing jobs anymore', async function () {
    const res = await getJobsListPaginationAndSort(servers[0].url, servers[0].accessToken, 0, 50, '-createdAt')
    const jobs = res.body.data

    for (const job of jobs) {
      expect(job.state).not.to.equal('pending')
      expect(job.state).not.to.equal('processing')
    }
  })

  it('Should follow server 1', async function () {
    servers[1] = await runServer(2)

    await follow(servers[1].url, [ servers[0].url ], servers[1].accessToken)

    await wait(5000)

    const res = await getFollowersListPaginationAndSort(servers[0].url, 0, 1, 'createdAt')
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
  })

  it('Should send a view to server 2, and automatically fetch the video', async function () {
    const resVideo = await getVideosList(servers[0].url)
    const videoServer1 = resVideo.body.data[0]

    await viewVideo(servers[0].url, videoServer1.uuid)

    await wait(5000)

    const res = await getVideosList(servers[1].url)
    const videoServer2 = res.body.data.find(v => v.url === videoServer1.url)

    expect(videoServer2).not.to.be.undefined

    await completeVideoCheck(servers[1].url, videoServer2, checkAttributes)

  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
