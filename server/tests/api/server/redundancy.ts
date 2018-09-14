/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoDetails } from '../../../../shared/models/videos'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  getFollowingListPaginationAndSort,
  getVideo,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait,
  root, viewVideo, immutableAssign
} from '../../utils'
import { waitJobs } from '../../utils/server/jobs'
import * as magnetUtil from 'magnet-uri'
import { updateRedundancy } from '../../utils/server/redundancy'
import { ActorFollow } from '../../../../shared/models/actors'
import { readdir } from 'fs-extra'
import { join } from 'path'
import { VideoRedundancyStrategy } from '../../../../shared/models/redundancy'

const expect = chai.expect

let servers: ServerInfo[] = []
let video1Server2UUID: string
let video2Server2UUID: string

function checkMagnetWebseeds (file: { magnetUri: string, resolution: { id: number } }, baseWebseeds: string[]) {
  const parsed = magnetUtil.decode(file.magnetUri)

  for (const ws of baseWebseeds) {
    const found = parsed.urlList.find(url => url === `${ws}-${file.resolution.id}.mp4`)
    expect(found, `Webseed ${ws} not found in ${file.magnetUri}`).to.not.be.undefined
  }
}

async function runServers (strategy: VideoRedundancyStrategy, additionalParams: any = {}) {
  const config = {
    redundancy: {
      videos: [
        immutableAssign({
          strategy: strategy,
          size: '100KB'
        }, additionalParams)
      ]
    }
  }
  servers = await flushAndRunMultipleServers(3, config)

  // Get the access tokens
  await setAccessTokensToServers(servers)

  {
    const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'video 1 server 2' })
    video1Server2UUID = res.body.video.uuid

    await viewVideo(servers[ 1 ].url, video1Server2UUID)
  }

  {
    const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'video 2 server 2' })
    video2Server2UUID = res.body.video.uuid
  }

  await waitJobs(servers)

  // Server 1 and server 2 follow each other
  await doubleFollow(servers[ 0 ], servers[ 1 ])
  // Server 1 and server 3 follow each other
  await doubleFollow(servers[ 0 ], servers[ 2 ])
  // Server 2 and server 3 follow each other
  await doubleFollow(servers[ 1 ], servers[ 2 ])

  await waitJobs(servers)
}

async function check1WebSeed () {
  const webseeds = [
    'http://localhost:9002/static/webseed/' + video1Server2UUID
  ]

  for (const server of servers) {
    const res = await getVideo(server.url, video1Server2UUID)

    const video: VideoDetails = res.body
    video.files.forEach(f => checkMagnetWebseeds(f, webseeds))
  }
}

async function enableRedundancy () {
  await updateRedundancy(servers[ 0 ].url, servers[ 0 ].accessToken, servers[ 1 ].host, true)

  const res = await getFollowingListPaginationAndSort(servers[ 0 ].url, 0, 5, '-createdAt')
  const follows: ActorFollow[] = res.body.data
  const server2 = follows.find(f => f.following.host === 'localhost:9002')
  const server3 = follows.find(f => f.following.host === 'localhost:9003')

  expect(server3).to.not.be.undefined
  expect(server3.following.hostRedundancyAllowed).to.be.false

  expect(server2).to.not.be.undefined
  expect(server2.following.hostRedundancyAllowed).to.be.true
}

async function check2Webseeds () {
  await waitJobs(servers)
  await wait(15000)
  await waitJobs(servers)

  const webseeds = [
    'http://localhost:9001/static/webseed/' + video1Server2UUID,
    'http://localhost:9002/static/webseed/' + video1Server2UUID
  ]

  for (const server of servers) {
    const res = await getVideo(server.url, video1Server2UUID)

    const video: VideoDetails = res.body

    for (const file of video.files) {
      checkMagnetWebseeds(file, webseeds)
    }
  }

  const files = await readdir(join(root(), 'test1', 'videos'))
  expect(files).to.have.lengthOf(4)

  for (const resolution of [ 240, 360, 480, 720 ]) {
    expect(files.find(f => f === `${video1Server2UUID}-${resolution}.mp4`)).to.not.be.undefined
  }
}

async function cleanServers () {
  killallServers(servers)
}

describe('Test videos redundancy', function () {

  describe('With most-views strategy', function () {

    before(function () {
      this.timeout(120000)

      return runServers('most-views')
    })

    it('Should have 1 webseed on the first video', function () {
      return check1WebSeed()
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancy()
    })

    it('Should have 2 webseed on the first video', function () {
      this.timeout(40000)

      return check2Webseeds()
    })

    after(function () {
      return cleanServers()
    })
  })

  describe('With trending strategy', function () {

    before(function () {
      this.timeout(120000)

      return runServers('trending')
    })

    it('Should have 1 webseed on the first video', function () {
      return check1WebSeed()
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancy()
    })

    it('Should have 2 webseed on the first video', function () {
      this.timeout(40000)

      return check2Webseeds()
    })

    after(function () {
      return cleanServers()
    })
  })

  describe('With recently added strategy', function () {

    before(function () {
      this.timeout(120000)

      return runServers('recently-added', { minViews: 3 })
    })

    it('Should have 1 webseed on the first video', function () {
      return check1WebSeed()
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancy()
    })

    it('Should still have 1 webseed on the first video', async function () {
      this.timeout(40000)

      await waitJobs(servers)
      await wait(15000)
      await waitJobs(servers)

      return check1WebSeed()
    })

    it('Should view 2 times the first video', async function () {
      this.timeout(40000)

      await viewVideo(servers[ 0 ].url, video1Server2UUID)
      await viewVideo(servers[ 2 ].url, video1Server2UUID)

      await wait(10000)
      await waitJobs(servers)
    })

    it('Should have 2 webseed on the first video', function () {
      this.timeout(40000)

      return check2Webseeds()
    })

    after(function () {
      return cleanServers()
    })
  })
})
