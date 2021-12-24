/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import {
  cleanupTests,
  createMultipleServers,
  createSingleServer,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'

chai.use(require('chai-xml'))
chai.use(require('chai-json-schema'))
chai.config.includeStack = true
const expect = chai.expect

describe('Test syndication feeds', () => {
  let servers: PeerTubeServer[] = []
  let serverHLSOnly: PeerTubeServer
  let userAccessToken: string
  let rootAccountId: number
  let rootChannelId: number
  let userAccountId: number
  let userChannelId: number
  let userFeedToken: string

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await createMultipleServers(2)
    serverHLSOnly = await createSingleServer(3, {
      transcoding: {
        enabled: true,
        webtorrent: { enabled: false },
        hls: { enabled: true }
      }
    })

    await setAccessTokensToServers([ ...servers, serverHLSOnly ])
    await doubleFollow(servers[0], servers[1])

    {
      const user = await servers[0].users.getMyInfo()
      rootAccountId = user.account.id
      rootChannelId = user.videoChannels[0].id
    }

    {
      userAccessToken = await servers[0].users.generateUserAndToken('john')

      const user = await servers[0].users.getMyInfo({ token: userAccessToken })
      userAccountId = user.account.id
      userChannelId = user.videoChannels[0].id

      const token = await servers[0].users.getMyScopedTokens({ token: userAccessToken })
      userFeedToken = token.feedToken
    }

    {
      await servers[0].videos.upload({ token: userAccessToken, attributes: { name: 'user video' } })
    }

    {
      const attributes = {
        name: 'my super name for server 1',
        description: 'my super description for server 1',
        fixture: 'video_short.webm'
      }
      const { id } = await servers[0].videos.upload({ attributes })

      await servers[0].comments.createThread({ videoId: id, text: 'super comment 1' })
      await servers[0].comments.createThread({ videoId: id, text: 'super comment 2' })
    }

    {
      const attributes = { name: 'unlisted video', privacy: VideoPrivacy.UNLISTED }
      const { id } = await servers[0].videos.upload({ attributes })

      await servers[0].comments.createThread({ videoId: id, text: 'comment on unlisted video' })
    }

    await waitJobs(servers)
  })

  describe('All feed', function () {

    it('Should be well formed XML (covers RSS 2.0 and ATOM 1.0 endpoints)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const rss = await servers[0].feed.getXML({ feed })
        expect(rss).xml.to.be.valid()

        const atom = await servers[0].feed.getXML({ feed, format: 'atom' })
        expect(atom).xml.to.be.valid()
      }
    })

    it('Should be well formed JSON (covers JSON feed 1.0 endpoint)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const jsonText = await servers[0].feed.getJSON({ feed })
        expect(JSON.parse(jsonText)).to.be.jsonSchema({ type: 'object' })
      }
    })

    it('Should serve the endpoint with a classic request', async function () {
      await makeGetRequest({
        url: servers[0].url,
        path: '/feeds/videos.xml',
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should serve the endpoint as a cached request', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/feeds/videos.xml',
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.headers['x-api-cache-cached']).to.equal('true')
    })

    it('Should not serve the endpoint as a cached request', async function () {
      const res = await makeGetRequest({
        url: servers[0].url,
        path: '/feeds/videos.xml?v=186',
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.headers['x-api-cache-cached']).to.not.exist
    })

    it('Should refuse to serve the endpoint without accept header', async function () {
      await makeGetRequest({ url: servers[0].url, path: '/feeds/videos.xml', expectedStatus: HttpStatusCode.NOT_ACCEPTABLE_406 })
    })
  })

  describe('Videos feed', function () {

    it('Should contain a valid enclosure (covers RSS 2.0 endpoint)', async function () {
      for (const server of servers) {
        const rss = await server.feed.getXML({ feed: 'videos' })
        expect(XMLValidator.validate(rss)).to.be.true

        const parser = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false })
        const xmlDoc = parser.parse(rss)

        const enclosure = xmlDoc.rss.channel.item[0].enclosure
        expect(enclosure).to.exist
        expect(enclosure['@_type']).to.equal('application/x-bittorrent')
        expect(enclosure['@_length']).to.equal(218910)
        expect(enclosure['@_url']).to.contain('720.torrent')
      }
    })

    it('Should contain a valid \'attachments\' object (covers JSON feed 1.0 endpoint)', async function () {
      for (const server of servers) {
        const json = await server.feed.getJSON({ feed: 'videos' })
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
        const json = await servers[0].feed.getJSON({ feed: 'videos', query: { accountId: rootAccountId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[0].author.name).to.equal('root')
      }

      {
        const json = await servers[0].feed.getJSON({ feed: 'videos', query: { accountId: userAccountId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('user video')
        expect(jsonObj.items[0].author.name).to.equal('john')
      }

      for (const server of servers) {
        {
          const json = await server.feed.getJSON({ feed: 'videos', query: { accountName: 'root@localhost:' + servers[0].port } })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        }

        {
          const json = await server.feed.getJSON({ feed: 'videos', query: { accountName: 'john@localhost:' + servers[0].port } })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
        }
      }
    })

    it('Should filter by video channel', async function () {
      {
        const json = await servers[0].feed.getJSON({ feed: 'videos', query: { videoChannelId: rootChannelId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[0].author.name).to.equal('root')
      }

      {
        const json = await servers[0].feed.getJSON({ feed: 'videos', query: { videoChannelId: userChannelId } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('user video')
        expect(jsonObj.items[0].author.name).to.equal('john')
      }

      for (const server of servers) {
        {
          const query = { videoChannelName: 'root_channel@localhost:' + servers[0].port }
          const json = await server.feed.getJSON({ feed: 'videos', query })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        }

        {
          const query = { videoChannelName: 'john_channel@localhost:' + servers[0].port }
          const json = await server.feed.getJSON({ feed: 'videos', query })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
        }
      }
    })

    it('Should correctly have videos feed with HLS only', async function () {
      this.timeout(120000)

      await serverHLSOnly.videos.upload({ attributes: { name: 'hls only video' } })

      await waitJobs([ serverHLSOnly ])

      const json = await serverHLSOnly.feed.getJSON({ feed: 'videos' })
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
        const json = await server.feed.getJSON({ feed: 'video-comments' })

        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[0].html_content).to.equal('super comment 2')
        expect(jsonObj.items[1].html_content).to.equal('super comment 1')
      }
    })

    it('Should not list comments from muted accounts or instances', async function () {
      this.timeout(30000)

      const remoteHandle = 'root@localhost:' + servers[0].port

      await servers[1].blocklist.addToServerBlocklist({ account: remoteHandle })

      {
        const json = await servers[1].feed.getJSON({ feed: 'video-comments', query: { version: 2 } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(0)
      }

      await servers[1].blocklist.removeFromServerBlocklist({ account: remoteHandle })

      {
        const videoUUID = (await servers[1].videos.quickUpload({ name: 'server 2' })).uuid
        await waitJobs(servers)
        await servers[0].comments.createThread({ videoId: videoUUID, text: 'super comment' })
        await waitJobs(servers)

        const json = await servers[1].feed.getJSON({ feed: 'video-comments', query: { version: 3 } })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(3)
      }

      await servers[1].blocklist.addToMyBlocklist({ account: remoteHandle })

      {
        const json = await servers[1].feed.getJSON({ feed: 'video-comments', query: { version: 4 } })
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
      await servers[0].users.create({ username: attr.username, password: attr.password })
      const feeduserAccessToken = await servers[0].login.getAccessToken(attr)

      {
        const user = await servers[0].users.getMyInfo({ token: feeduserAccessToken })
        feeduserAccountId = user.account.id
      }

      {
        const token = await servers[0].users.getMyScopedTokens({ token: feeduserAccessToken })
        feeduserFeedToken = token.feedToken
      }

      {
        const body = await servers[0].subscriptions.listVideos({ token: feeduserAccessToken })
        expect(body.total).to.equal(0)

        const query = { accountId: feeduserAccountId, token: feeduserFeedToken }
        const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(0) // no subscription, it should not list the instance's videos but list 0 videos
      }
    })

    it('Should fail with an invalid token', async function () {
      const query = { accountId: feeduserAccountId, token: 'toto' }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a token of another user', async function () {
      const query = { accountId: feeduserAccountId, token: userFeedToken }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should list no videos for a user with videos but no subscriptions', async function () {
      const body = await servers[0].subscriptions.listVideos({ token: userAccessToken })
      expect(body.total).to.equal(0)

      const query = { accountId: userAccountId, token: userFeedToken }
      const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query })
      const jsonObj = JSON.parse(json)
      expect(jsonObj.items.length).to.be.equal(0) // no subscription, it should not list the instance's videos but list 0 videos
    })

    it('Should list self videos for a user with a subscription to themselves', async function () {
      this.timeout(30000)

      await servers[0].subscriptions.add({ token: userAccessToken, targetUri: 'john_channel@localhost:' + servers[0].port })
      await waitJobs(servers)

      {
        const body = await servers[0].subscriptions.listVideos({ token: userAccessToken })
        expect(body.total).to.equal(1)
        expect(body.data[0].name).to.equal('user video')

        const query = { accountId: userAccountId, token: userFeedToken, version: 1 }
        const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1) // subscribed to self, it should not list the instance's videos but list john's
      }
    })

    it('Should list videos of a user\'s subscription', async function () {
      this.timeout(30000)

      await servers[0].subscriptions.add({ token: userAccessToken, targetUri: 'root_channel@localhost:' + servers[0].port })
      await waitJobs(servers)

      {
        const body = await servers[0].subscriptions.listVideos({ token: userAccessToken })
        expect(body.total).to.equal(2, "there should be 2 videos part of the subscription")

        const query = { accountId: userAccountId, token: userFeedToken, version: 2 }
        const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2) // subscribed to root, it should not list the instance's videos but list root/john's
      }
    })

    it('Should renew the token, and so have an invalid old token', async function () {
      await servers[0].users.renewMyScopedTokens({ token: userAccessToken })

      const query = { accountId: userAccountId, token: userFeedToken, version: 3 }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the new token', async function () {
      const token = await servers[0].users.getMyScopedTokens({ token: userAccessToken })
      userFeedToken = token.feedToken

      const query = { accountId: userAccountId, token: userFeedToken, version: 4 }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query })
    })

  })

  after(async function () {
    await cleanupTests([ ...servers, serverHLSOnly ])
  })
})
