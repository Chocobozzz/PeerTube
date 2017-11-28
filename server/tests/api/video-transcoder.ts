/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  uploadVideo,
  getVideosList,
  wait,
  setAccessTokensToServers,
  flushAndRunMultipleServers,
  killallServers,
  webtorrentAdd,
  getVideo
} from '../utils'

describe('Test video transcoding', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(10000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
  })

  it('Should not transcode video on server 1', async function () {
    this.timeout(60000)

    const videoAttributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1',
      fixture: 'video_short.webm'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await wait(10000)

    const res = await getVideosList(servers[0].url)
    const video = res.body.data[0]

    const res2 = await getVideo(servers[0].url, video.id)
    const videoDetails = res2.body
    expect(videoDetails.files).to.have.lengthOf(1)

    const magnetUri = videoDetails.files[0].magnetUri
    expect(magnetUri).to.match(/\.webm/)

    const torrent = await webtorrentAdd(magnetUri)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).match(/\.webm$/)
  })

  it('Should transcode video on server 2', async function () {
    this.timeout(60000)

    const videoAttributes = {
      name: 'my super name for server 2',
      description: 'my super description for server 2',
      fixture: 'video_short.webm'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await wait(20000)

    const res = await getVideosList(servers[1].url)

    const video = res.body.data[0]
    const res2 = await getVideo(servers[1].url, video.id)
    const videoDetails = res2.body

    expect(videoDetails.files).to.have.lengthOf(4)

    const magnetUri = videoDetails.files[0].magnetUri
    expect(magnetUri).to.match(/\.mp4/)

    const torrent = await webtorrentAdd(magnetUri)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).match(/\.mp4$/)
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
