/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoDetails, VideoImport, VideoPrivacy } from '../../../../shared/models/videos'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  getMyUserInformation,
  getMyVideos,
  getVideo,
  getVideosList,
  immutableAssign,
  killallServers,
  ServerInfo,
  setAccessTokensToServers
} from '../../utils'
import { waitJobs } from '../../utils/server/jobs'
import { getMagnetURI, getYoutubeVideoUrl, importVideo, getMyVideoImports } from '../../utils/videos/video-imports'

const expect = chai.expect

describe('Test video imports', function () {
  let servers: ServerInfo[] = []
  let channelIdServer1: number
  let channelIdServer2: number

  async function checkVideosServer1 (url: string, idHttp: string, idMagnet: string, idTorrent: string) {
    const resHttp = await getVideo(url, idHttp)
    const videoHttp: VideoDetails = resHttp.body

    expect(videoHttp.name).to.equal('small video - youtube')
    expect(videoHttp.category.label).to.equal('News')
    expect(videoHttp.licence.label).to.equal('Attribution')
    expect(videoHttp.language.label).to.equal('Unknown')
    expect(videoHttp.nsfw).to.be.false
    expect(videoHttp.description).to.equal('this is a super description')
    expect(videoHttp.tags).to.deep.equal([ 'tag1', 'tag2' ])
    expect(videoHttp.files).to.have.lengthOf(1)

    const resMagnet = await getVideo(url, idMagnet)
    const videoMagnet: VideoDetails = resMagnet.body
    const resTorrent = await getVideo(url, idTorrent)
    const videoTorrent: VideoDetails = resTorrent.body

    for (const video of [ videoMagnet, videoTorrent ]) {
      expect(video.category.label).to.equal('Misc')
      expect(video.licence.label).to.equal('Unknown')
      expect(video.language.label).to.equal('Unknown')
      expect(video.nsfw).to.be.false
      expect(video.description).to.equal('this is a super torrent description')
      expect(video.tags).to.deep.equal([ 'tag_torrent1', 'tag_torrent2' ])
      expect(video.files).to.have.lengthOf(1)
    }

    expect(videoTorrent.name).to.contain('你好 世界 720p.mp4')
    expect(videoMagnet.name).to.contain('super peertube2 video')
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

  it('Should import videos on server 1', async function () {
    this.timeout(60000)

    const baseAttributes = {
      channelId: channelIdServer1,
      privacy: VideoPrivacy.PUBLIC
    }

    {
      const attributes = immutableAssign(baseAttributes, { targetUrl: getYoutubeVideoUrl() })
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      expect(res.body.video.name).to.equal('small video - youtube')
    }

    {
      const attributes = immutableAssign(baseAttributes, {
        magnetUri: getMagnetURI(),
        description: 'this is a super torrent description',
        tags: [ 'tag_torrent1', 'tag_torrent2' ]
      })
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      expect(res.body.video.name).to.equal('super peertube2 video')
    }

    {
      const attributes = immutableAssign(baseAttributes, {
        torrentfile: 'video-720p.torrent',
        description: 'this is a super torrent description',
        tags: [ 'tag_torrent1', 'tag_torrent2' ]
      })
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      expect(res.body.video.name).to.equal('你好 世界 720p.mp4')
    }
  })

  it('Should list the videos to import in my videos on server 1', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 5, 'createdAt')

    expect(res.body.total).to.equal(3)

    const videos = res.body.data
    expect(videos).to.have.lengthOf(3)
    expect(videos[0].name).to.equal('small video - youtube')
    expect(videos[1].name).to.equal('super peertube2 video')
    expect(videos[2].name).to.equal('你好 世界 720p.mp4')
  })

  it('Should list the videos to import in my imports on server 1', async function () {
    const res = await getMyVideoImports(servers[0].url, servers[0].accessToken, '-createdAt')

    expect(res.body.total).to.equal(3)
    const videoImports: VideoImport[] = res.body.data
    expect(videoImports).to.have.lengthOf(3)

    expect(videoImports[2].targetUrl).to.equal(getYoutubeVideoUrl())
    expect(videoImports[2].magnetUri).to.be.null
    expect(videoImports[2].torrentName).to.be.null
    expect(videoImports[2].video.name).to.equal('small video - youtube')

    expect(videoImports[1].targetUrl).to.be.null
    expect(videoImports[1].magnetUri).to.equal(getMagnetURI())
    expect(videoImports[1].torrentName).to.be.null
    expect(videoImports[1].video.name).to.equal('super peertube2 video')

    expect(videoImports[0].targetUrl).to.be.null
    expect(videoImports[0].magnetUri).to.be.null
    expect(videoImports[0].torrentName).to.equal('video-720p.torrent')
    expect(videoImports[0].video.name).to.equal('你好 世界 720p.mp4')
  })

  it('Should have the video listed on the two instances', async function () {
    this.timeout(120000)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.total).to.equal(3)
      expect(res.body.data).to.have.lengthOf(3)

      const [ videoHttp, videoMagnet, videoTorrent ] = res.body.data
      await checkVideosServer1(server.url, videoHttp.uuid, videoMagnet.uuid, videoTorrent.uuid)
    }
  })

  it('Should import a video on server 2 with some fields', async function () {
    this.timeout(60000)

    const attributes = {
      targetUrl: getYoutubeVideoUrl(),
      channelId: channelIdServer2,
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

  it('Should have the videos listed on the two instances', async function () {
    this.timeout(120000)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.total).to.equal(4)
      expect(res.body.data).to.have.lengthOf(4)

      await checkVideoServer2(server.url, res.body.data[0].uuid)

      const [ ,videoHttp, videoMagnet, videoTorrent ] = res.body.data
      await checkVideosServer1(server.url, videoHttp.uuid, videoMagnet.uuid, videoTorrent.uuid)
    }
  })

  it('Should import a video that will be transcoded', async function () {
    this.timeout(120000)

    const attributes = {
      name: 'transcoded video',
      magnetUri: getMagnetURI(),
      channelId: channelIdServer2,
      privacy: VideoPrivacy.PUBLIC
    }
    const res = await importVideo(servers[1].url, servers[1].accessToken, attributes)
    const videoUUID = res.body.video.uuid

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)
      const video: VideoDetails = res.body

      expect(video.name).to.equal('transcoded video')
      expect(video.files).to.have.lengthOf(4)
    }
  })

  after(async function () {
    killallServers(servers)
  })
})
