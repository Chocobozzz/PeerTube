/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import * as lodash from 'lodash'
import 'mocha'
import {
  addVideoToBlacklist,
  flushAndRunMultipleServers,
  getBlacklistedVideosList,
  getMyVideos,
  getSortedBlacklistedVideosList,
  getVideosList,
  killallServers,
  removeVideoFromBlacklist,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoBlacklist,
  uploadVideo
} from '../../utils/index'
import { doubleFollow } from '../../utils/server/follows'
import { waitJobs } from '../../utils/server/jobs'
import { VideoAbuse } from '../../../../shared/models/videos'

const expect = chai.expect
const orderBy = lodash.orderBy

describe('Test video blacklist management', function () {
  let servers: ServerInfo[] = []
  let videoId: number

  async function blacklistVideosOnServer (server: ServerInfo) {
    const res = await getVideosList(server.url)

    const videos = res.body.data
    for (let video of videos) {
      await addVideoToBlacklist(server.url, server.accessToken, video.id, 'super reason')
    }
  }

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    // Upload 2 videos on server 2
    await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'My 1st video', description: 'A video on server 2' })
    await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'My 2nd video', description: 'A video on server 2' })

    // Wait videos propagation, server 2 has transcoding enabled
    await waitJobs(servers)

    // Blacklist the two videos on server 1
    await blacklistVideosOnServer(servers[0])
  })

  describe('When listing blacklisted videos', function () {
    it('Should display all the blacklisted videos', async function () {
      const res = await getBlacklistedVideosList(servers[0].url, servers[0].accessToken)

      expect(res.body.total).to.equal(2)

      const blacklistedVideos = res.body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      for (const blacklistedVideo of blacklistedVideos) {
        expect(blacklistedVideo.reason).to.equal('super reason')
        videoId = blacklistedVideo.video.id
      }
    })

    it('Should get the correct sort when sorting by descending id', async function () {
      const res = await getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-id')
      expect(res.body.total).to.equal(2)

      const blacklistedVideos = res.body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      const result = orderBy(res.body.data, [ 'id' ], [ 'desc' ])

      expect(blacklistedVideos).to.deep.equal(result)
    })

    it('Should get the correct sort when sorting by descending video name', async function () {
      const res = await getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name')
      expect(res.body.total).to.equal(2)

      const blacklistedVideos = res.body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      const result = orderBy(res.body.data, [ 'name' ], [ 'desc' ])

      expect(blacklistedVideos).to.deep.equal(result)
    })

    it('Should get the correct sort when sorting by ascending creation date', async function () {
      const res = await getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, 'createdAt')
      expect(res.body.total).to.equal(2)

      const blacklistedVideos = res.body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      const result = orderBy(res.body.data, [ 'createdAt' ])

      expect(blacklistedVideos).to.deep.equal(result)
    })
  })

  describe('When updating blacklisted videos', function () {
    it('Should change the reason', async function () {
      await updateVideoBlacklist(servers[0].url, servers[0].accessToken, videoId, 'my super reason updated')

      const res = await getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name')
      const video = res.body.data.find(b => b.video.id === videoId)

      expect(video.reason).to.equal('my super reason updated')
    })
  })

  describe('When listing my videos', function () {
    it('Should display blacklisted videos', async function () {
      await blacklistVideosOnServer(servers[1])

      const res = await getMyVideos(servers[1].url, servers[1].accessToken, 0, 5)

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      for (const video of res.body.data) {
        expect(video.blacklisted).to.be.true
        expect(video.blacklistedReason).to.equal('super reason')
      }
    })
  })

  describe('When removing a blacklisted video', function () {
    let videoToRemove: VideoAbuse
    let blacklist = []

    it('Should not have any video in videos list on server 1', async function () {
      const res = await getVideosList(servers[0].url)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)
    })

    it('Should remove a video from the blacklist on server 1', async function () {
      // Get one video in the blacklist
      const res = await getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name')
      videoToRemove = res.body.data[0]
      blacklist = res.body.data.slice(1)

      // Remove it
      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, videoToRemove.video.id)
    })

    it('Should have the ex-blacklisted video in videos list on server 1', async function () {
      const res = await getVideosList(servers[0].url)
      expect(res.body.total).to.equal(1)

      const videos = res.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(1)

      expect(videos[0].name).to.equal(videoToRemove.video.name)
      expect(videos[0].id).to.equal(videoToRemove.video.id)
    })

    it('Should not have the ex-blacklisted video in videos blacklist list on server 1', async function () {
      const res = await getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name')
      expect(res.body.total).to.equal(1)

      const videos = res.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(1)
      expect(videos).to.deep.equal(blacklist)
    })
  })

  after(async function () {
    killallServers(servers)
  })
})
