/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushAndRunMultipleServers,
  uploadVideo,
  makeFriends,
  getVideosList,
  wait,
  setAccessTokensToServers,
  getVideoAbusesList,
  reportVideoAbuse,
  killallServers,
  flushTests
} from '../utils'

describe('Test video abuses', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(100000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Pod 1 makes friend with pod 2
    await makeFriends(servers[0].url, servers[0].accessToken)

    // Upload some videos on each pods
    const video1Attributes = {
      name: 'my super name for pod 1',
      description: 'my super description for pod 1'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, video1Attributes)

    const video2Attributes = {
      name: 'my super name for pod 2',
      description: 'my super description for pod 2'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, video2Attributes)

    // Wait videos propagation
    await wait(22000)

    const res = await getVideosList(servers[0].url)
    const videos = res.body.data

    expect(videos.length).to.equal(2)

    servers[0].video = videos.find(video => video.name === 'my super name for pod 1')
    servers[1].video = videos.find(video => video.name === 'my super name for pod 2')
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

    // We wait requests propagation, even if the pod 1 is not supposed to make a request to pod 2
    await wait(11000)
  })

  it('Should have 1 video abuses on pod 1 and 0 on pod 2', async function () {
    const res1 = await getVideoAbusesList(servers[0].url, servers[0].accessToken)

    expect(res1.body.total).to.equal(1)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data.length).to.equal(1)

    const abuse = res1.body.data[0]
    expect(abuse.reason).to.equal('my super bad reason')
    expect(abuse.reporterUsername).to.equal('root')
    expect(abuse.reporterPodHost).to.equal('localhost:9001')
    expect(abuse.videoId).to.equal(servers[0].video.id)

    const res2 = await getVideoAbusesList(servers[1].url, servers[1].accessToken)
    expect(res2.body.total).to.equal(0)
    expect(res2.body.data).to.be.an('array')
    expect(res2.body.data.length).to.equal(0)
  })

  it('Should report abuse on a remote video', async function () {
    this.timeout(15000)

    const reason = 'my super bad reason 2'
    await reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[1].video.id, reason)

    // We wait requests propagation
    await wait(11000)
  })

  it('Should have 2 video abuse on pod 1 and 1 on pod 2', async function () {
    const res1 = await getVideoAbusesList(servers[0].url, servers[0].accessToken)
    expect(res1.body.total).to.equal(2)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data.length).to.equal(2)

    const abuse1 = res1.body.data[0]
    expect(abuse1.reason).to.equal('my super bad reason')
    expect(abuse1.reporterUsername).to.equal('root')
    expect(abuse1.reporterPodHost).to.equal('localhost:9001')
    expect(abuse1.videoId).to.equal(servers[0].video.id)

    const abuse2 = res1.body.data[1]
    expect(abuse2.reason).to.equal('my super bad reason 2')
    expect(abuse2.reporterUsername).to.equal('root')
    expect(abuse2.reporterPodHost).to.equal('localhost:9001')
    expect(abuse2.videoId).to.equal(servers[1].video.id)

    const res2 = await getVideoAbusesList(servers[1].url, servers[1].accessToken)
    expect(res2.body.total).to.equal(1)
    expect(res2.body.data).to.be.an('array')
    expect(res2.body.data.length).to.equal(1)

    const abuse3 = res2.body.data[0]
    expect(abuse3.reason).to.equal('my super bad reason 2')
    expect(abuse3.reporterUsername).to.equal('root')
    expect(abuse3.reporterPodHost).to.equal('localhost:9001')
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
