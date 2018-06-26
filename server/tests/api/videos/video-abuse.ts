/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoAbuse } from '../../../../shared/models/videos'
import {
  flushAndRunMultipleServers,
  getVideoAbusesList,
  getVideosList,
  killallServers,
  reportVideoAbuse,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../utils/index'
import { doubleFollow } from '../../utils/server/follows'
import { waitJobs } from '../../utils/server/jobs'

const expect = chai.expect

describe('Test video abuses', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    // Upload some videos on each servers
    const video1Attributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, video1Attributes)

    const video2Attributes = {
      name: 'my super name for server 2',
      description: 'my super description for server 2'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, video2Attributes)

    // Wait videos propagation, server 2 has transcoding enabled
    await waitJobs(servers)

    const res = await getVideosList(servers[0].url)
    const videos = res.body.data

    expect(videos.length).to.equal(2)

    servers[0].video = videos.find(video => video.name === 'my super name for server 1')
    servers[1].video = videos.find(video => video.name === 'my super name for server 2')
  })

  it('Should not have video abuses', async function () {
    const res = await getVideoAbusesList(servers[0].url, servers[0].accessToken)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should report abuse on a local video', async function () {
    this.timeout(15000)

    const reason = 'my super bad reason'
    await reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[0].video.id, reason)

    // We wait requests propagation, even if the server 1 is not supposed to make a request to server 2
    await waitJobs(servers)
  })

  it('Should have 1 video abuses on server 1 and 0 on server 2', async function () {
    const res1 = await getVideoAbusesList(servers[0].url, servers[0].accessToken)

    expect(res1.body.total).to.equal(1)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data.length).to.equal(1)

    const abuse: VideoAbuse = res1.body.data[0]
    expect(abuse.reason).to.equal('my super bad reason')
    expect(abuse.reporterAccount.name).to.equal('root')
    expect(abuse.reporterAccount.host).to.equal('localhost:9001')
    expect(abuse.video.id).to.equal(servers[0].video.id)

    const res2 = await getVideoAbusesList(servers[1].url, servers[1].accessToken)
    expect(res2.body.total).to.equal(0)
    expect(res2.body.data).to.be.an('array')
    expect(res2.body.data.length).to.equal(0)
  })

  it('Should report abuse on a remote video', async function () {
    this.timeout(10000)

    const reason = 'my super bad reason 2'
    await reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[1].video.id, reason)

    // We wait requests propagation
    await waitJobs(servers)
  })

  it('Should have 2 video abuse on server 1 and 1 on server 2', async function () {
    const res1 = await getVideoAbusesList(servers[0].url, servers[0].accessToken)
    expect(res1.body.total).to.equal(2)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data.length).to.equal(2)

    const abuse1: VideoAbuse = res1.body.data[0]
    expect(abuse1.reason).to.equal('my super bad reason')
    expect(abuse1.reporterAccount.name).to.equal('root')
    expect(abuse1.reporterAccount.host).to.equal('localhost:9001')
    expect(abuse1.video.id).to.equal(servers[0].video.id)

    const abuse2: VideoAbuse = res1.body.data[1]
    expect(abuse2.reason).to.equal('my super bad reason 2')
    expect(abuse2.reporterAccount.name).to.equal('root')
    expect(abuse2.reporterAccount.host).to.equal('localhost:9001')
    expect(abuse2.video.id).to.equal(servers[1].video.id)

    const res2 = await getVideoAbusesList(servers[1].url, servers[1].accessToken)
    expect(res2.body.total).to.equal(1)
    expect(res2.body.data).to.be.an('array')
    expect(res2.body.data.length).to.equal(1)

    const abuse3: VideoAbuse = res2.body.data[0]
    expect(abuse3.reason).to.equal('my super bad reason 2')
    expect(abuse3.reporterAccount.name).to.equal('root')
    expect(abuse3.reporterAccount.host).to.equal('localhost:9001')
  })

  after(async function () {
    killallServers(servers)
  })
})
