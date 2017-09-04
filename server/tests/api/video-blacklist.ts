/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  uploadVideo,
  makeFriends,
  getVideosList,
  wait,
  setAccessTokensToServers,
  flushAndRunMultipleServers,
  addVideoToBlacklist,
  searchVideo,
  killallServers
} from '../utils'

describe('Test video blacklists', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Pod 1 makes friend with pod 2
    await makeFriends(servers[0].url, servers[0].accessToken)

    // Upload a video on pod 2
    const videoAttributes = {
      name: 'my super name for pod 2',
      description: 'my super description for pod 2'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    // Wait videos propagation
    await wait(22000)

    const res = await getVideosList(servers[0].url)
    const videos = res.body.data

    expect(videos.length).to.equal(1)

    servers[0].remoteVideo = videos.find(video => video.name === 'my super name for pod 2')
  })

  it('Should blacklist a remote video on pod 1', async function () {
    await addVideoToBlacklist(servers[0].url, servers[0].accessToken, servers[0].remoteVideo.id)
  })

  it('Should not have the video blacklisted in videos list on pod 1', async function () {
    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should not have the video blacklisted in videos search on pod 1', async function () {
    const res = await searchVideo(servers[0].url, 'name')

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should have the blacklisted video in videos list on pod 2', async function () {
    const res = await getVideosList(servers[1].url)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)
  })

  it('Should have the video blacklisted in videos search on pod 2', async function () {
    const res = await searchVideo(servers[1].url, 'name')

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
