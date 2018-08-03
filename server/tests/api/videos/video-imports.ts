/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoDetails, VideoPrivacy } from '../../../../shared/models/videos'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  getMyUserInformation,
  getMyVideos,
  getVideo,
  getVideosList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers
} from '../../utils'
import { waitJobs } from '../../utils/server/jobs'
import { getMyVideoImports, getYoutubeVideoUrl, importVideo } from '../../utils/videos/video-imports'

const expect = chai.expect

describe('Test video imports', function () {
  let servers: ServerInfo[] = []
  let channelIdServer1: number
  let channelIdServer2: number

  async function checkVideoServer1 (url: string, id: number | string) {
    const res = await getVideo(url, id)
    const video: VideoDetails = res.body

    expect(video.name).to.equal('small video - youtube')
    expect(video.category.label).to.equal('News')
    expect(video.licence.label).to.equal('Attribution')
    expect(video.language.label).to.equal('Unknown')
    expect(video.nsfw).to.be.false
    expect(video.description).to.equal('this is a super description')
    expect(video.tags).to.deep.equal([ 'tag1', 'tag2' ])

    expect(video.files).to.have.lengthOf(1)
  }

  async function checkVideoServer2 (url: string, id: number | string) {
    const res = await getVideo(url, id)
    const video = res.body

    expect(video.name).to.equal('my super name')
    expect(video.category.label).to.equal('Entertainment')
    expect(video.licence.label).to.equal('Public Domain Dedication')
    expect(video.language.label).to.equal('English')
    expect(video.nsfw).to.be.false
    expect(video.description).to.equal('my super description')
    expect(video.tags).to.deep.equal([ 'supertag1', 'supertag2' ])

    expect(video.files).to.have.lengthOf(1)
  }

  before(async function () {
    this.timeout(30000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    {
      const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
      channelIdServer1 = res.body.videoChannels[ 0 ].id
    }

    {
      const res = await getMyUserInformation(servers[1].url, servers[1].accessToken)
      channelIdServer2 = res.body.videoChannels[ 0 ].id
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should import a video on server 1', async function () {
    this.timeout(60000)

    const attributes = {
      targetUrl: getYoutubeVideoUrl(),
      channelId: channelIdServer1,
      privacy: VideoPrivacy.PUBLIC
    }
    const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
    expect(res.body.video.name).to.equal('small video - youtube')
  })

  it('Should list the video to import in my videos on server 1', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 5)

    expect(res.body.total).to.equal(1)

    const videos = res.body.data
    expect(videos).to.have.lengthOf(1)
    expect(videos[0].name).to.equal('small video - youtube')
  })

  it('Should list the video to import in my imports on server 1', async function () {
    const res = await getMyVideoImports(servers[0].url, servers[0].accessToken)

    expect(res.body.total).to.equal(1)
    const videoImports = res.body.data
    expect(videoImports).to.have.lengthOf(1)

    expect(videoImports[0].targetUrl).to.equal(getYoutubeVideoUrl())
    expect(videoImports[0].video.name).to.equal('small video - youtube')
  })

  it('Should have the video listed on the two instances1', async function () {
    this.timeout(120000)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)

      await checkVideoServer1(server.url, res.body.data[0].uuid)
    }
  })

  it('Should import a video on server 2 with some fields', async function () {
    this.timeout(60000)

    const attributes = {
      targetUrl: getYoutubeVideoUrl(),
      channelId: channelIdServer1,
      privacy: VideoPrivacy.PUBLIC,
      category: 10,
      licence: 7,
      language: 'en',
      name: 'my super name',
      description: 'my super description',
      tags: [ 'supertag1', 'supertag2' ]
    }
    const res = await importVideo(servers[1].url, servers[1].accessToken, attributes)
    expect(res.body.video.name).to.equal('my super name')
  })

  it('Should have the video listed on the two instances', async function () {
    this.timeout(120000)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      await checkVideoServer2(server.url, res.body.data[0].uuid)
      await checkVideoServer1(server.url, res.body.data[1].uuid)
    }
  })

  after(async function () {
    killallServers(servers)
  })
})
