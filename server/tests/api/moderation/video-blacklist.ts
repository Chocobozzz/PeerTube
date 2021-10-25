/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { orderBy } from 'lodash'
import {
  BlacklistCommand,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  FIXTURE_URLS,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/extra-utils'
import { UserAdminFlag, UserRole, VideoBlacklist, VideoBlacklistType } from '@shared/models'

const expect = chai.expect

describe('Test video blacklist', function () {
  let servers: PeerTubeServer[] = []
  let videoId: number
  let command: BlacklistCommand

  async function blacklistVideosOnServer (server: PeerTubeServer) {
    const { data } = await server.videos.list()

    for (const video of data) {
      await server.blacklist.add({ videoId: video.id, reason: 'super reason' })
    }
  }

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    // Upload 2 videos on server 2
    await servers[1].videos.upload({ attributes: { name: 'My 1st video', description: 'A video on server 2' } })
    await servers[1].videos.upload({ attributes: { name: 'My 2nd video', description: 'A video on server 2' } })

    // Wait videos propagation, server 2 has transcoding enabled
    await waitJobs(servers)

    command = servers[0].blacklist

    // Blacklist the two videos on server 1
    await blacklistVideosOnServer(servers[0])
  })

  describe('When listing/searching videos', function () {

    it('Should not have the video blacklisted in videos list/search on server 1', async function () {
      {
        const { total, data } = await servers[0].videos.list()

        expect(total).to.equal(0)
        expect(data).to.be.an('array')
        expect(data.length).to.equal(0)
      }

      {
        const body = await servers[0].search.searchVideos({ search: 'video' })

        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data.length).to.equal(0)
      }
    })

    it('Should have the blacklisted video in videos list/search on server 2', async function () {
      {
        const { total, data } = await servers[1].videos.list()

        expect(total).to.equal(2)
        expect(data).to.be.an('array')
        expect(data.length).to.equal(2)
      }

      {
        const body = await servers[1].search.searchVideos({ search: 'video' })

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

      const { total, data } = await servers[1].videos.listMyVideos()

      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      for (const video of data) {
        expect(video.blacklisted).to.be.true
        expect(video.blacklistedReason).to.equal('super reason')
      }
    })
  })

  describe('When removing a blacklisted video', function () {
    let videoToRemove: VideoBlacklist
    let blacklist = []

    it('Should not have any video in videos list on server 1', async function () {
      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(0)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(0)
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
      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(1)

      expect(data).to.be.an('array')
      expect(data.length).to.equal(1)

      expect(data[0].name).to.equal(videoToRemove.video.name)
      expect(data[0].id).to.equal(videoToRemove.video.id)
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
        const { uuid } = await servers[0].videos.upload({ attributes: { name: 'Video 3' } })
        video3UUID = uuid
      }
      {
        const { uuid } = await servers[0].videos.upload({ attributes: { name: 'Video 4' } })
        video4UUID = uuid
      }

      await waitJobs(servers)
    })

    it('Should blacklist video 3 and keep it federated', async function () {
      this.timeout(10000)

      await command.add({ videoId: video3UUID, reason: 'super reason', unfederate: false })

      await waitJobs(servers)

      {
        const { data } = await servers[0].videos.list()
        expect(data.find(v => v.uuid === video3UUID)).to.be.undefined
      }

      {
        const { data } = await servers[1].videos.list()
        expect(data.find(v => v.uuid === video3UUID)).to.not.be.undefined
      }
    })

    it('Should unfederate the video', async function () {
      this.timeout(10000)

      await command.add({ videoId: video4UUID, reason: 'super reason', unfederate: true })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()
        expect(data.find(v => v.uuid === video4UUID)).to.be.undefined
      }
    })

    it('Should have the video unfederated even after an Update AP message', async function () {
      this.timeout(10000)

      await servers[0].videos.update({ id: video4UUID, attributes: { description: 'super description' } })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()
        expect(data.find(v => v.uuid === video4UUID)).to.be.undefined
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
        const { data } = await server.videos.list()
        expect(data.find(v => v.uuid === video4UUID)).to.not.be.undefined
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
      await servers[0].run(config)

      {
        const user = { username: 'user_without_flag', password: 'password' }
        await servers[0].users.create({
          username: user.username,
          adminFlags: UserAdminFlag.NONE,
          password: user.password,
          role: UserRole.USER
        })

        userWithoutFlag = await servers[0].login.getAccessToken(user)

        const { videoChannels } = await servers[0].users.getMyInfo({ token: userWithoutFlag })
        channelOfUserWithoutFlag = videoChannels[0].id
      }

      {
        const user = { username: 'user_with_flag', password: 'password' }
        await servers[0].users.create({
          username: user.username,
          adminFlags: UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST,
          password: user.password,
          role: UserRole.USER
        })

        userWithFlag = await servers[0].login.getAccessToken(user)
      }

      await waitJobs(servers)
    })

    it('Should auto blacklist a video on upload', async function () {
      await servers[0].videos.upload({ token: userWithoutFlag, attributes: { name: 'blacklisted' } })

      const body = await command.list({ type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(1)
      expect(body.data[0].video.name).to.equal('blacklisted')
    })

    it('Should auto blacklist a video on URL import', async function () {
      this.timeout(15000)

      const attributes = {
        targetUrl: FIXTURE_URLS.goodVideo,
        name: 'URL import',
        channelId: channelOfUserWithoutFlag
      }
      await servers[0].imports.importVideo({ token: userWithoutFlag, attributes })

      const body = await command.list({ sort: 'createdAt', type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(2)
      expect(body.data[1].video.name).to.equal('URL import')
    })

    it('Should auto blacklist a video on torrent import', async function () {
      const attributes = {
        magnetUri: FIXTURE_URLS.magnet,
        name: 'Torrent import',
        channelId: channelOfUserWithoutFlag
      }
      await servers[0].imports.importVideo({ token: userWithoutFlag, attributes })

      const body = await command.list({ sort: 'createdAt', type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(3)
      expect(body.data[2].video.name).to.equal('Torrent import')
    })

    it('Should not auto blacklist a video on upload if the user has the bypass blacklist flag', async function () {
      await servers[0].videos.upload({ token: userWithFlag, attributes: { name: 'not blacklisted' } })

      const body = await command.list({ type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED })
      expect(body.total).to.equal(3)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
