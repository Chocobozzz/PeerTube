/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import * as xmlParser from 'fast-xml-parser'
import { HttpStatusCode } from '@shared/core-utils'
import {
  addUserSubscription,
  addVideoCommentThread,
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushAndRunServer,
  getMyUserInformation,
  getUserScopedTokens,
  listUserSubscriptionVideos,
  renewUserScopedTokens,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  uploadVideoAndGetId,
  userLogin,
  waitJobs
} from '@shared/extra-utils'
import { User, VideoPrivacy } from '@shared/models'
import { ScopedToken } from '@shared/models/users/user-scoped-token'

chai.use(require('chai-xml'))
chai.use(require('chai-json-schema'))
chai.config.includeStack = true
const expect = chai.expect

describe('Test syndication feeds', () => {
  let servers: ServerInfo[] = []
  let serverHLSOnly: ServerInfo
  let userAccessToken: string
  let rootAccountId: number
  let rootChannelId: number
  let userAccountId: number
  let userChannelId: number
  let userFeedToken: string

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)
    serverHLSOnly = await flushAndRunServer(3, {
      transcoding: {
        enabled: true,
        webtorrent: { enabled: false },
        hls: { enabled: true }
      }
    })

    await setAccessTokensToServers([ ...servers, serverHLSOnly ])
    await doubleFollow(servers[0], servers[1])

    {
      const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
      const user: User = res.body
      rootAccountId = user.account.id
      rootChannelId = user.videoChannels[0].id
    }

    {
      const attr = { username: 'john', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: attr.username, password: attr.password })
      userAccessToken = await userLogin(servers[0], attr)

      const res = await getMyUserInformation(servers[0].url, userAccessToken)
      const user: User = res.body
      userAccountId = user.account.id
      userChannelId = user.videoChannels[0].id

      const res2 = await getUserScopedTokens(servers[0].url, userAccessToken)
      const token: ScopedToken = res2.body
      userFeedToken = token.feedToken
    }

    {
      await uploadVideo(servers[0].url, userAccessToken, { name: 'user video' })
    }

    {
      const videoAttributes = {
        name: 'my super name for server 1',
        description: 'my super description for server 1',
        fixture: 'video_short.webm'
      }
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
      const videoId = res.body.video.id

      await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoId, 'super comment 1')
      await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoId, 'super comment 2')
    }

    {
      const videoAttributes = { name: 'unlisted video', privacy: VideoPrivacy.UNLISTED }
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
      const videoId = res.body.video.id

      await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoId, 'comment on unlisted video')
    }

    await waitJobs(servers)
  })

  describe('All feed', function () {

    it('Should be well formed XML (covers RSS 2.0 and ATOM 1.0 endpoints)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const rss = await servers[0].feedCommand.getXML({ feed })
        expect(rss).xml.to.be.valid()

        const atom = await servers[0].feedCommand.getXML({ feed, format: 'atom' })
        expect(atom).xml.to.be.valid()
      }
    })

    it('Should be well formed JSON (covers JSON feed 1.0 endpoint)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const jsonText = await servers[0].feedCommand.getJSON({ feed })
        expect(JSON.parse(jsonText)).to.be.jsonSchema({ type: 'object' })
      }
    })
  })

  describe('Videos feed', function () {

    it('Should contain a valid enclosure (covers RSS 2.0 endpoint)', async function () {
      for (const server of servers) {
        const rss = await server.feedCommand.getXML({ feed: 'videos' })
        expect(xmlParser.validate(rss)).to.be.true

        const xmlDoc = xmlParser.parse(rss, { parseAttributeValue: true, ignoreAttributes: false })

        const enclosure = xmlDoc.rss.channel.item[0].enclosure
        expect(enclosure).to.exist
        expect(enclosure['@_type']).to.equal('application/x-bittorrent')
        expect(enclosure['@_length']).to.equal(218910)
        expect(enclosure['@_url']).to.contain('720.torrent')
      }
    })

    it('Should contain a valid \'attachments\' object (covers JSON feed 1.0 endpoint)', async function () {
      for (const server of servers) {
        const json = await server.feedCommand.getJSON({ feed: 'videos' })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[0].attachments).to.exist
        expect(jsonObj.items[0].attachments.length).to.be.eq(1)
        expect(jsonObj.items[0].attachments[0].mime_type).to.be.eq('application/x-bittorrent')
        expect(jsonObj.items[0].attachments[0].size_in_bytes).to.be.eq(218910)
        expect(jsonObj.items[0].attachments[0].url).to.contain('720.torrent')
      }
    })

    it('Should filter by account', async function () {
      {
        const json = await servers[0].feedCommand.getJSON({ feed: 'videos', query: { accountId: rootAccountId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[0].author.name).to.equal('root')
      }

      {
        const json = await servers[0].feedCommand.getJSON({ feed: 'videos', query: { accountId: userAccountId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('user video')
        expect(jsonObj.items[0].author.name).to.equal('john')
      }

      for (const server of servers) {
        {
          const json = await server.feedCommand.getJSON({ feed: 'videos', query: { accountName: 'root@localhost:' + servers[0].port } })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        }

        {
          const json = await server.feedCommand.getJSON({ feed: 'videos', query: { accountName: 'john@localhost:' + servers[0].port } })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
        }
      }
    })

    it('Should filter by video channel', async function () {
      {
        const json = await servers[0].feedCommand.getJSON({ feed: 'videos', query: { videoChannelId: rootChannelId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[0].author.name).to.equal('root')
      }

      {
        const json = await servers[0].feedCommand.getJSON({ feed: 'videos', query: { videoChannelId: userChannelId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('user video')
        expect(jsonObj.items[0].author.name).to.equal('john')
      }

      for (const server of servers) {
        {
          const query = { videoChannelName: 'root_channel@localhost:' + servers[0].port }
          const json = await server.feedCommand.getJSON({ feed: 'videos', query })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        }

        {
          const query = { videoChannelName: 'john_channel@localhost:' + servers[0].port }
          const json = await server.feedCommand.getJSON({ feed: 'videos', query })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
        }
      }
    })

    it('Should correctly have videos feed with HLS only', async function () {
      this.timeout(120000)

      await uploadVideo(serverHLSOnly.url, serverHLSOnly.accessToken, { name: 'hls only video' })

      await waitJobs([ serverHLSOnly ])

      const json = await serverHLSOnly.feedCommand.getJSON({ feed: 'videos' })
      const jsonObj = JSON.parse(json)
      expect(jsonObj.items.length).to.be.equal(1)
      expect(jsonObj.items[0].attachments).to.exist
      expect(jsonObj.items[0].attachments.length).to.be.eq(4)

      for (let i = 0; i < 4; i++) {
        expect(jsonObj.items[0].attachments[i].mime_type).to.be.eq('application/x-bittorrent')
        expect(jsonObj.items[0].attachments[i].size_in_bytes).to.be.greaterThan(0)
        expect(jsonObj.items[0].attachments[i].url).to.exist
      }
    })
  })

  describe('Video comments feed', function () {

    it('Should contain valid comments (covers JSON feed 1.0 endpoint) and not from unlisted videos', async function () {
      for (const server of servers) {
        const json = await server.feedCommand.getJSON({ feed: 'video-comments' })

        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[0].html_content).to.equal('super comment 2')
        expect(jsonObj.items[1].html_content).to.equal('super comment 1')
      }
    })

    it('Should not list comments from muted accounts or instances', async function () {
      this.timeout(30000)

      const remoteHandle = 'root@localhost:' + servers[0].port

      await servers[1].blocklistCommand.addToServerBlocklist({ account: remoteHandle })

      {
        const json = await servers[1].feedCommand.getJSON({ feed: 'video-comments', query: { version: 2 } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(0)
      }

      await servers[1].blocklistCommand.removeFromServerBlocklist({ account: remoteHandle })

      {
        const videoUUID = (await uploadVideoAndGetId({ server: servers[1], videoName: 'server 2' })).uuid
        await waitJobs(servers)
        await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'super comment')
        await waitJobs(servers)

        const json = await servers[1].feedCommand.getJSON({ feed: 'video-comments', query: { version: 3 } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(3)
      }

      await servers[1].blocklistCommand.addToMyBlocklist({ account: remoteHandle })

      {
        const json = await servers[1].feedCommand.getJSON({ feed: 'video-comments', query: { version: 4 } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2)
      }
    })
  })

  describe('Video feed from my subscriptions', function () {
    let feeduserAccountId: number
    let feeduserFeedToken: string

    it('Should list no videos for a user with no videos and no subscriptions', async function () {
      const attr = { username: 'feeduser', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: attr.username, password: attr.password })
      const feeduserAccessToken = await userLogin(servers[0], attr)

      {
        const res = await getMyUserInformation(servers[0].url, feeduserAccessToken)
        const user: User = res.body
        feeduserAccountId = user.account.id
      }

      {
        const res = await getUserScopedTokens(servers[0].url, feeduserAccessToken)
        const token: ScopedToken = res.body
        feeduserFeedToken = token.feedToken
      }

      {
        const res = await listUserSubscriptionVideos(servers[0].url, feeduserAccessToken)
        expect(res.body.total).to.equal(0)

        const query = { accountId: feeduserAccountId, token: feeduserFeedToken }
        const json = await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(0) // no subscription, it should not list the instance's videos but list 0 videos
      }
    })

    it('Should fail with an invalid token', async function () {
      const query = { accountId: feeduserAccountId, token: 'toto' }
      await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a token of another user', async function () {
      const query = { accountId: feeduserAccountId, token: userFeedToken }
      await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should list no videos for a user with videos but no subscriptions', async function () {
      const res = await listUserSubscriptionVideos(servers[0].url, userAccessToken)
      expect(res.body.total).to.equal(0)

      const query = { accountId: userAccountId, token: userFeedToken }
      const json = await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query })
      const jsonObj = JSON.parse(json)
      expect(jsonObj.items.length).to.be.equal(0) // no subscription, it should not list the instance's videos but list 0 videos
    })

    it('Should list self videos for a user with a subscription to themselves', async function () {
      this.timeout(30000)

      await addUserSubscription(servers[0].url, userAccessToken, 'john_channel@localhost:' + servers[0].port)
      await waitJobs(servers)

      {
        const res = await listUserSubscriptionVideos(servers[0].url, userAccessToken)
        expect(res.body.total).to.equal(1)
        expect(res.body.data[0].name).to.equal('user video')

        const query = { accountId: userAccountId, token: userFeedToken, version: 1 }
        const json = await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1) // subscribed to self, it should not list the instance's videos but list john's
      }
    })

    it('Should list videos of a user\'s subscription', async function () {
      this.timeout(30000)

      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:' + servers[0].port)
      await waitJobs(servers)

      {
        const res = await listUserSubscriptionVideos(servers[0].url, userAccessToken)
        expect(res.body.total).to.equal(2, "there should be 2 videos part of the subscription")

        const query = { accountId: userAccountId, token: userFeedToken, version: 2 }
        const json = await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2) // subscribed to root, it should not list the instance's videos but list root/john's
      }
    })

    it('Should renew the token, and so have an invalid old token', async function () {
      await renewUserScopedTokens(servers[0].url, userAccessToken)

      const query = { accountId: userAccountId, token: userFeedToken, version: 3 }
      await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the new token', async function () {
      const res2 = await getUserScopedTokens(servers[0].url, userAccessToken)
      const token: ScopedToken = res2.body
      userFeedToken = token.feedToken

      const query = { accountId: userAccountId, token: userFeedToken, version: 4 }
      await servers[0].feedCommand.getJSON({ feed: 'subscriptions', query })
    })

  })

  after(async function () {
    await cleanupTests([ ...servers, serverHLSOnly ])
  })
})
