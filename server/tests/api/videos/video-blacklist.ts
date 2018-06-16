/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  addVideoToBlacklist,
  flushAndRunMultipleServers,
  getVideosList,
  killallServers,
  searchVideo,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../utils/index'
import { doubleFollow } from '../../utils/server/follows'
import { waitJobs } from '../../utils/server/jobs'

const expect = chai.expect

describe('Test video blacklists', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    // Upload a video on server 2
    const videoAttributes = {
      name: 'my super name for server 2',
      description: 'my super description for server 2'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    // Wait videos propagation, server 2 has transcoding enabled
    await waitJobs(servers)

    const res = await getVideosList(servers[0].url)
    const videos = res.body.data

    expect(videos.length).to.equal(1)

    servers[0].remoteVideo = videos.find(video => video.name === 'my super name for server 2')
  })

  it('Should blacklist a remote video on server 1', async function () {
    await addVideoToBlacklist(servers[0].url, servers[0].accessToken, servers[0].remoteVideo.id)
  })

  it('Should not have the video blacklisted in videos list on server 1', async function () {
    const res = await getVideosList(servers[0].url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should not have the video blacklisted in videos search on server 1', async function () {
    const res = await searchVideo(servers[0].url, 'name')

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should have the blacklisted video in videos list on server 2', async function () {
    const res = await getVideosList(servers[1].url)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)
  })

  it('Should have the video blacklisted in videos search on server 2', async function () {
    const res = await searchVideo(servers[1].url, 'name')

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)
  })

  after(async function () {
    killallServers(servers)
  })
})
