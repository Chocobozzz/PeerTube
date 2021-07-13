/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { orderBy } from 'lodash'
import {
  BlacklistCommand,
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getMyUserInformation,
  getMyVideos,
  getVideosList,
  ImportsCommand,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  waitJobs
} from '@shared/extra-utils'
import { User, UserAdminFlag, UserRole, VideoBlacklist, VideoBlacklistType } from '@shared/models'

const expect = chai.expect

describe('Test video blacklist', function () {
  let servers: ServerInfo[] = []
  let videoId: number
  let command: BlacklistCommand

  async function blacklistVideosOnServer (server: ServerInfo) {
    const res = await getVideosList(server.url)

    const videos = res.body.data
    for (const video of videos) {
      await server.blacklistCommand.add({ videoId: video.id, reason: 'super reason' })
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

    command = servers[0].blacklistCommand

    // Blacklist the two videos on server 1
    await blacklistVideosOnServer(servers[0])
  })

  describe('When listing/searching videos', function () {

    it('Should not have the video blacklisted in videos list/search on server 1', async function () {
      {
        const res = await getVideosList(servers[0].url)

        expect(res.body.total).to.equal(0)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data.length).to.equal(0)
      }

      {
        const body = await servers[0].searchCommand.searchVideos({ search: 'video' })

        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data.length).to.equal(0)
      }
    })

    it('Should have the blacklisted video in videos list/search on server 2', async function () {
      {
        const res = await getVideosList(servers[1].url)

        expect(res.body.total).to.equal(2)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data.length).to.equal(2)
      }

      {
        const body = await servers[1].searchCommand.searchVideos({ search: 'video' })

        expect(body.total).to.equal(2)
        expect(body.data).to.be.an('array')
        expect(body.data.length).to.equal(2)
      }
    })
  })

  describe('When listing manually blacklisted videos', function () {
    it('Should display all the blacklisted videos', async function () {
      const body = await command.list()
      expect(body.total).to.equal(2)

      const blacklistedVideos = body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      for (const blacklistedVideo of blacklistedVideos) {
        expect(blacklistedVideo.reason).to.equal('super reason')
        videoId = blacklistedVideo.video.id
      }
    })

    it('Should display all the blacklisted videos when applying manual type filter', async function () {
      const body = await command.list({ type: VideoBlacklistType.MANUAL })
      expect(body.total).to.equal(2)

      const blacklistedVideos = body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)
    })

    it('Should display nothing when applying automatic type filter', async function () {
      const body = await command.list({ type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(0)

      const blacklistedVideos = body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(0)
    })

    it('Should get the correct sort when sorting by descending id', async function () {
      const body = await command.list({ sort: '-id' })
      expect(body.total).to.equal(2)

      const blacklistedVideos = body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      const result = orderBy(body.data, [ 'id' ], [ 'desc' ])
      expect(blacklistedVideos).to.deep.equal(result)
    })

    it('Should get the correct sort when sorting by descending video name', async function () {
      const body = await command.list({ sort: '-name' })
      expect(body.total).to.equal(2)

      const blacklistedVideos = body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      const result = orderBy(body.data, [ 'name' ], [ 'desc' ])
      expect(blacklistedVideos).to.deep.equal(result)
    })

    it('Should get the correct sort when sorting by ascending creation date', async function () {
      const body = await command.list({ sort: 'createdAt' })
      expect(body.total).to.equal(2)

      const blacklistedVideos = body.data
      expect(blacklistedVideos).to.be.an('array')
      expect(blacklistedVideos.length).to.equal(2)

      const result = orderBy(body.data, [ 'createdAt' ])
      expect(blacklistedVideos).to.deep.equal(result)
    })
  })

  describe('When updating blacklisted videos', function () {
    it('Should change the reason', async function () {
      await command.update({ videoId, reason: 'my super reason updated' })

      const body = await command.list({ sort: '-name' })
      const video = body.data.find(b => b.video.id === videoId)

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
    let videoToRemove: VideoBlacklist
    let blacklist = []

    it('Should not have any video in videos list on server 1', async function () {
      const res = await getVideosList(servers[0].url)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)
    })

    it('Should remove a video from the blacklist on server 1', async function () {
      // Get one video in the blacklist
      const body = await command.list({ sort: '-name' })
      videoToRemove = body.data[0]
      blacklist = body.data.slice(1)

      // Remove it
      await command.remove({ videoId: videoToRemove.video.id })
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
      const body = await command.list({ sort: '-name' })
      expect(body.total).to.equal(1)

      const videos = body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(1)
      expect(videos).to.deep.equal(blacklist)
    })
  })

  describe('When blacklisting local videos', function () {
    let video3UUID: string
    let video4UUID: string

    before(async function () {
      this.timeout(10000)

      {
        const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'Video 3' })
        video3UUID = res.body.video.uuid
      }
      {
        const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'Video 4' })
        video4UUID = res.body.video.uuid
      }

      await waitJobs(servers)
    })

    it('Should blacklist video 3 and keep it federated', async function () {
      this.timeout(10000)

      await command.add({ videoId: video3UUID, reason: 'super reason', unfederate: false })

      await waitJobs(servers)

      {
        const res = await getVideosList(servers[0].url)
        expect(res.body.data.find(v => v.uuid === video3UUID)).to.be.undefined
      }

      {
        const res = await getVideosList(servers[1].url)
        expect(res.body.data.find(v => v.uuid === video3UUID)).to.not.be.undefined
      }
    })

    it('Should unfederate the video', async function () {
      this.timeout(10000)

      await command.add({ videoId: video4UUID, reason: 'super reason', unfederate: true })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        expect(res.body.data.find(v => v.uuid === video4UUID)).to.be.undefined
      }
    })

    it('Should have the video unfederated even after an Update AP message', async function () {
      this.timeout(10000)

      await updateVideo(servers[0].url, servers[0].accessToken, video4UUID, { description: 'super description' })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        expect(res.body.data.find(v => v.uuid === video4UUID)).to.be.undefined
      }
    })

    it('Should have the correct video blacklist unfederate attribute', async function () {
      const body = await command.list({ sort: 'createdAt' })

      const blacklistedVideos = body.data
      const video3Blacklisted = blacklistedVideos.find(b => b.video.uuid === video3UUID)
      const video4Blacklisted = blacklistedVideos.find(b => b.video.uuid === video4UUID)

      expect(video3Blacklisted.unfederated).to.be.false
      expect(video4Blacklisted.unfederated).to.be.true
    })

    it('Should remove the video from blacklist and refederate the video', async function () {
      this.timeout(10000)

      await command.remove({ videoId: video4UUID })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        expect(res.body.data.find(v => v.uuid === video4UUID)).to.not.be.undefined
      }
    })

  })

  describe('When auto blacklist videos', function () {
    let userWithoutFlag: string
    let userWithFlag: string
    let channelOfUserWithoutFlag: number

    before(async function () {
      this.timeout(20000)

      await killallServers([ servers[0] ])

      const config = {
        auto_blacklist: {
          videos: {
            of_users: {
              enabled: true
            }
          }
        }
      }
      await reRunServer(servers[0], config)

      {
        const user = { username: 'user_without_flag', password: 'password' }
        await createUser({
          url: servers[0].url,
          accessToken: servers[0].accessToken,
          username: user.username,
          adminFlags: UserAdminFlag.NONE,
          password: user.password,
          role: UserRole.USER
        })

        userWithoutFlag = await servers[0].loginCommand.getAccessToken(user)

        const res = await getMyUserInformation(servers[0].url, userWithoutFlag)
        const body: User = res.body
        channelOfUserWithoutFlag = body.videoChannels[0].id
      }

      {
        const user = { username: 'user_with_flag', password: 'password' }
        await createUser({
          url: servers[0].url,
          accessToken: servers[0].accessToken,
          username: user.username,
          adminFlags: UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST,
          password: user.password,
          role: UserRole.USER
        })

        userWithFlag = await servers[0].loginCommand.getAccessToken(user)
      }

      await waitJobs(servers)
    })

    it('Should auto blacklist a video on upload', async function () {
      await uploadVideo(servers[0].url, userWithoutFlag, { name: 'blacklisted' })

      const body = await command.list({ type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(1)
      expect(body.data[0].video.name).to.equal('blacklisted')
    })

    it('Should auto blacklist a video on URL import', async function () {
      this.timeout(15000)

      const attributes = {
        targetUrl: ImportsCommand.getGoodVideoUrl(),
        name: 'URL import',
        channelId: channelOfUserWithoutFlag
      }
      await servers[0].importsCommand.importVideo({ token: userWithoutFlag, attributes })

      const body = await command.list({ sort: 'createdAt', type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(2)
      expect(body.data[1].video.name).to.equal('URL import')
    })

    it('Should auto blacklist a video on torrent import', async function () {
      const attributes = {
        magnetUri: ImportsCommand.getMagnetURI(),
        name: 'Torrent import',
        channelId: channelOfUserWithoutFlag
      }
      await servers[0].importsCommand.importVideo({ token: userWithoutFlag, attributes })

      const body = await command.list({ sort: 'createdAt', type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(3)
      expect(body.data[2].video.name).to.equal('Torrent import')
    })

    it('Should not auto blacklist a video on upload if the user has the bypass blacklist flag', async function () {
      await uploadVideo(servers[0].url, userWithFlag, { name: 'not blacklisted' })

      const body = await command.list({ type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(3)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
