/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  createSingleServer,
  doubleFollow,
  makeGetRequest,
  makeRawRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultChannelAvatar,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@shared/server-commands'

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

  let liveId: string

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
    await setDefaultChannelAvatar(servers[0])
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableLive({ allowReplay: false, transcoding: false })

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

    await serverHLSOnly.videos.upload({ attributes: { name: 'hls only video' } })

    await waitJobs([ ...servers, serverHLSOnly ])

    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath('-podcast-custom-tags') })
  })

  describe('All feed', function () {

    it('Should be well formed XML (covers RSS 2.0 and ATOM 1.0 endpoints)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const rss = await servers[0].feed.getXML({ feed, ignoreCache: true })
        expect(rss).xml.to.be.valid()

        const atom = await servers[0].feed.getXML({ feed, format: 'atom', ignoreCache: true })
        expect(atom).xml.to.be.valid()
      }
    })

    it('Should be well formed XML (covers Podcast endpoint)', async function () {
      const podcast = await servers[0].feed.getPodcastXML({ ignoreCache: true, channelId: rootChannelId })
      expect(podcast).xml.to.be.valid()
    })

    it('Should be well formed JSON (covers JSON feed 1.0 endpoint)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const jsonText = await servers[0].feed.getJSON({ feed, ignoreCache: true })
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

    it('Should refuse to serve the endpoint without accept header', async function () {
      await makeGetRequest({ url: servers[0].url, path: '/feeds/videos.xml', expectedStatus: HttpStatusCode.NOT_ACCEPTABLE_406 })
    })
  })

  describe('Videos feed', function () {

    describe('Podcast feed', function () {

      it('Should contain a valid podcast:alternateEnclosure', async function () {
        // Since podcast feeds should only work on the server they originate on,
        // only test the first server where the videos reside
        const rss = await servers[0].feed.getPodcastXML({ ignoreCache: false, channelId: rootChannelId })
        expect(XMLValidator.validate(rss)).to.be.true

        const parser = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false })
        const xmlDoc = parser.parse(rss)

        const itemGuid = xmlDoc.rss.channel.item.guid
        expect(itemGuid).to.exist
        expect(itemGuid['@_isPermaLink']).to.equal(true)

        const enclosure = xmlDoc.rss.channel.item.enclosure
        expect(enclosure).to.exist
        const alternateEnclosure = xmlDoc.rss.channel.item['podcast:alternateEnclosure']
        expect(alternateEnclosure).to.exist

        expect(alternateEnclosure['@_type']).to.equal('video/webm')
        expect(alternateEnclosure['@_length']).to.equal(218910)
        expect(alternateEnclosure['@_lang']).to.equal('zh')
        expect(alternateEnclosure['@_title']).to.equal('720p')
        expect(alternateEnclosure['@_default']).to.equal(true)

        expect(alternateEnclosure['podcast:source'][0]['@_uri']).to.contain('-720.webm')
        expect(alternateEnclosure['podcast:source'][0]['@_uri']).to.equal(enclosure['@_url'])
        expect(alternateEnclosure['podcast:source'][1]['@_uri']).to.contain('-720.torrent')
        expect(alternateEnclosure['podcast:source'][1]['@_contentType']).to.equal('application/x-bittorrent')
        expect(alternateEnclosure['podcast:source'][2]['@_uri']).to.contain('magnet:?')
      })

      it('Should contain a valid podcast:alternateEnclosure with HLS only', async function () {
        const rss = await serverHLSOnly.feed.getPodcastXML({ ignoreCache: false, channelId: rootChannelId })
        expect(XMLValidator.validate(rss)).to.be.true

        const parser = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false })
        const xmlDoc = parser.parse(rss)

        const itemGuid = xmlDoc.rss.channel.item.guid
        expect(itemGuid).to.exist
        expect(itemGuid['@_isPermaLink']).to.equal(true)

        const enclosure = xmlDoc.rss.channel.item.enclosure
        const alternateEnclosure = xmlDoc.rss.channel.item['podcast:alternateEnclosure']
        expect(alternateEnclosure).to.exist

        expect(alternateEnclosure['@_type']).to.equal('application/x-mpegURL')
        expect(alternateEnclosure['@_lang']).to.equal('zh')
        expect(alternateEnclosure['@_title']).to.equal('HLS')
        expect(alternateEnclosure['@_default']).to.equal(true)

        expect(alternateEnclosure['podcast:source']['@_uri']).to.contain('-master.m3u8')
        expect(alternateEnclosure['podcast:source']['@_uri']).to.equal(enclosure['@_url'])
      })

      it('Should contain a valid podcast:socialInteract', async function () {
        const rss = await servers[0].feed.getPodcastXML({ ignoreCache: false, channelId: rootChannelId })
        expect(XMLValidator.validate(rss)).to.be.true

        const parser = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false })
        const xmlDoc = parser.parse(rss)

        const item = xmlDoc.rss.channel.item
        const socialInteract = item['podcast:socialInteract']
        expect(socialInteract).to.exist
        expect(socialInteract['@_protocol']).to.equal('activitypub')
        expect(socialInteract['@_uri']).to.exist
        expect(socialInteract['@_accountUrl']).to.exist
      })

      it('Should contain a valid support custom tags for plugins', async function () {
        const rss = await servers[0].feed.getPodcastXML({ ignoreCache: false, channelId: userChannelId })
        expect(XMLValidator.validate(rss)).to.be.true

        const parser = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false })
        const xmlDoc = parser.parse(rss)

        const fooTag = xmlDoc.rss.channel.fooTag
        expect(fooTag).to.exist
        expect(fooTag['@_bar']).to.equal('baz')
        expect(fooTag['#text']).to.equal(42)

        const bizzBuzzItem = xmlDoc.rss.channel['biz:buzzItem']
        expect(bizzBuzzItem).to.exist

        let nestedTag = bizzBuzzItem.nestedTag
        expect(nestedTag).to.exist
        expect(nestedTag).to.equal('example nested tag')

        const item = xmlDoc.rss.channel.item
        const fizzTag = item.fizzTag
        expect(fizzTag).to.exist
        expect(fizzTag['@_bar']).to.equal('baz')
        expect(fizzTag['#text']).to.equal(21)

        const bizzBuzz = item['biz:buzz']
        expect(bizzBuzz).to.exist

        nestedTag = bizzBuzz.nestedTag
        expect(nestedTag).to.exist
        expect(nestedTag).to.equal('example nested tag')
      })

      it('Should contain a valid podcast:liveItem for live streams', async function () {
        this.timeout(120000)

        const { uuid } = await servers[0].live.create({
          fields: {
            name: 'live-0',
            privacy: VideoPrivacy.PUBLIC,
            channelId: rootChannelId,
            permanentLive: false
          }
        })
        liveId = uuid

        const ffmpeg = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveId, copyCodecs: true, fixtureName: 'video_short.mp4' })
        await servers[0].live.waitUntilPublished({ videoId: liveId })

        const rss = await servers[0].feed.getPodcastXML({ ignoreCache: false, channelId: rootChannelId })
        expect(XMLValidator.validate(rss)).to.be.true

        const parser = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false })
        const xmlDoc = parser.parse(rss)
        const liveItem = xmlDoc.rss.channel['podcast:liveItem']
        expect(liveItem.title).to.equal('live-0')
        expect(liveItem.guid['@_isPermaLink']).to.equal(false)
        expect(liveItem.guid['#text']).to.contain(`${uuid}_`)
        expect(liveItem['@_status']).to.equal('live')

        const enclosure = liveItem.enclosure
        const alternateEnclosure = liveItem['podcast:alternateEnclosure']
        expect(alternateEnclosure).to.exist
        expect(alternateEnclosure['@_type']).to.equal('application/x-mpegURL')
        expect(alternateEnclosure['@_title']).to.equal('HLS live stream')
        expect(alternateEnclosure['@_default']).to.equal(true)

        expect(alternateEnclosure['podcast:source']['@_uri']).to.contain('/master.m3u8')
        expect(alternateEnclosure['podcast:source']['@_uri']).to.equal(enclosure['@_url'])

        await stopFfmpeg(ffmpeg)

        await servers[0].live.waitUntilEnded({ videoId: liveId })

        await waitJobs(servers)
      })
    })

    describe('JSON feed', function () {

      it('Should contain a valid \'attachments\' object', async function () {
        for (const server of servers) {
          const json = await server.feed.getJSON({ feed: 'videos', ignoreCache: true })
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
          const json = await servers[0].feed.getJSON({ feed: 'videos', query: { accountId: rootAccountId }, ignoreCache: true })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
          expect(jsonObj.items[0].author.name).to.equal('Main root channel')
        }

        {
          const json = await servers[0].feed.getJSON({ feed: 'videos', query: { accountId: userAccountId }, ignoreCache: true })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
          expect(jsonObj.items[0].author.name).to.equal('Main john channel')
        }

        for (const server of servers) {
          {
            const json = await server.feed.getJSON({ feed: 'videos', query: { accountName: 'root@' + servers[0].host }, ignoreCache: true })
            const jsonObj = JSON.parse(json)
            expect(jsonObj.items.length).to.be.equal(1)
            expect(jsonObj.items[0].title).to.equal('my super name for server 1')
          }

          {
            const json = await server.feed.getJSON({ feed: 'videos', query: { accountName: 'john@' + servers[0].host }, ignoreCache: true })
            const jsonObj = JSON.parse(json)
            expect(jsonObj.items.length).to.be.equal(1)
            expect(jsonObj.items[0].title).to.equal('user video')
          }
        }
      })

      it('Should filter by video channel', async function () {
        {
          const json = await servers[0].feed.getJSON({ feed: 'videos', query: { videoChannelId: rootChannelId }, ignoreCache: true })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
          expect(jsonObj.items[0].author.name).to.equal('Main root channel')
        }

        {
          const json = await servers[0].feed.getJSON({ feed: 'videos', query: { videoChannelId: userChannelId }, ignoreCache: true })
          const jsonObj = JSON.parse(json)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
          expect(jsonObj.items[0].author.name).to.equal('Main john channel')
        }

        for (const server of servers) {
          {
            const query = { videoChannelName: 'root_channel@' + servers[0].host }
            const json = await server.feed.getJSON({ feed: 'videos', query, ignoreCache: true })
            const jsonObj = JSON.parse(json)
            expect(jsonObj.items.length).to.be.equal(1)
            expect(jsonObj.items[0].title).to.equal('my super name for server 1')
          }

          {
            const query = { videoChannelName: 'john_channel@' + servers[0].host }
            const json = await server.feed.getJSON({ feed: 'videos', query, ignoreCache: true })
            const jsonObj = JSON.parse(json)
            expect(jsonObj.items.length).to.be.equal(1)
            expect(jsonObj.items[0].title).to.equal('user video')
          }
        }
      })

      it('Should correctly have videos feed with HLS only', async function () {
        this.timeout(120000)

        const json = await serverHLSOnly.feed.getJSON({ feed: 'videos', ignoreCache: true })
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

      it('Should not display waiting live videos', async function () {
        const { uuid } = await servers[0].live.create({
          fields: {
            name: 'live',
            privacy: VideoPrivacy.PUBLIC,
            channelId: rootChannelId
          }
        })
        liveId = uuid

        const json = await servers[0].feed.getJSON({ feed: 'videos', ignoreCache: true })

        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[1].title).to.equal('user video')
      })

      it('Should display published live videos', async function () {
        this.timeout(120000)

        const ffmpeg = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveId, copyCodecs: true, fixtureName: 'video_short.mp4' })
        await servers[0].live.waitUntilPublished({ videoId: liveId })

        const json = await servers[0].feed.getJSON({ feed: 'videos', ignoreCache: true })

        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(3)
        expect(jsonObj.items[0].title).to.equal('live')
        expect(jsonObj.items[1].title).to.equal('my super name for server 1')
        expect(jsonObj.items[2].title).to.equal('user video')

        await stopFfmpeg(ffmpeg)
      })

      it('Should have the channel avatar as feed icon', async function () {
        const json = await servers[0].feed.getJSON({ feed: 'videos', query: { videoChannelId: rootChannelId }, ignoreCache: true })

        const jsonObj = JSON.parse(json)
        const imageUrl = jsonObj.icon
        expect(imageUrl).to.include('/lazy-static/avatars/')
        await makeRawRequest({ url: imageUrl, expectedStatus: HttpStatusCode.OK_200 })
      })
    })
  })

  describe('Video comments feed', function () {

    it('Should contain valid comments (covers JSON feed 1.0 endpoint) and not from unlisted videos', async function () {
      for (const server of servers) {
        const json = await server.feed.getJSON({ feed: 'video-comments', ignoreCache: true })

        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[0].content_html).to.contain('<p>super comment 2</p>')
        expect(jsonObj.items[1].content_html).to.contain('<p>super comment 1</p>')
      }
    })

    it('Should not list comments from muted accounts or instances', async function () {
      this.timeout(30000)

      const remoteHandle = 'root@' + servers[0].host

      await servers[1].blocklist.addToServerBlocklist({ account: remoteHandle })

      {
        const json = await servers[1].feed.getJSON({ feed: 'video-comments', ignoreCache: true })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(0)
      }

      await servers[1].blocklist.removeFromServerBlocklist({ account: remoteHandle })

      {
        const videoUUID = (await servers[1].videos.quickUpload({ name: 'server 2' })).uuid
        await waitJobs(servers)
        await servers[0].comments.createThread({ videoId: videoUUID, text: 'super comment' })
        await waitJobs(servers)

        const json = await servers[1].feed.getJSON({ feed: 'video-comments', ignoreCache: true })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(3)
      }

      await servers[1].blocklist.addToMyBlocklist({ account: remoteHandle })

      {
        const json = await servers[1].feed.getJSON({ feed: 'video-comments', ignoreCache: true })
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
        const body = await servers[0].videos.listMySubscriptionVideos({ token: feeduserAccessToken })
        expect(body.total).to.equal(0)

        const query = { accountId: feeduserAccountId, token: feeduserFeedToken }
        const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query, ignoreCache: true })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(0) // no subscription, it should not list the instance's videos but list 0 videos
      }
    })

    it('Should fail with an invalid token', async function () {
      const query = { accountId: feeduserAccountId, token: 'toto' }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403, ignoreCache: true })
    })

    it('Should fail with a token of another user', async function () {
      const query = { accountId: feeduserAccountId, token: userFeedToken }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403, ignoreCache: true })
    })

    it('Should list no videos for a user with videos but no subscriptions', async function () {
      const body = await servers[0].videos.listMySubscriptionVideos({ token: userAccessToken })
      expect(body.total).to.equal(0)

      const query = { accountId: userAccountId, token: userFeedToken }
      const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query, ignoreCache: true })
      const jsonObj = JSON.parse(json)
      expect(jsonObj.items.length).to.be.equal(0) // no subscription, it should not list the instance's videos but list 0 videos
    })

    it('Should list self videos for a user with a subscription to themselves', async function () {
      this.timeout(30000)

      await servers[0].subscriptions.add({ token: userAccessToken, targetUri: 'john_channel@' + servers[0].host })
      await waitJobs(servers)

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: userAccessToken })
        expect(body.total).to.equal(1)
        expect(body.data[0].name).to.equal('user video')

        const query = { accountId: userAccountId, token: userFeedToken }
        const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query, ignoreCache: true })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(1) // subscribed to self, it should not list the instance's videos but list john's
      }
    })

    it('Should list videos of a user\'s subscription', async function () {
      this.timeout(30000)

      await servers[0].subscriptions.add({ token: userAccessToken, targetUri: 'root_channel@' + servers[0].host })
      await waitJobs(servers)

      {
        const body = await servers[0].videos.listMySubscriptionVideos({ token: userAccessToken })
        expect(body.total).to.equal(2, 'there should be 2 videos part of the subscription')

        const query = { accountId: userAccountId, token: userFeedToken }
        const json = await servers[0].feed.getJSON({ feed: 'subscriptions', query, ignoreCache: true })
        const jsonObj = JSON.parse(json)
        expect(jsonObj.items.length).to.be.equal(2) // subscribed to root, it should not list the instance's videos but list root/john's
      }
    })

    it('Should renew the token, and so have an invalid old token', async function () {
      await servers[0].users.renewMyScopedTokens({ token: userAccessToken })

      const query = { accountId: userAccountId, token: userFeedToken }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, expectedStatus: HttpStatusCode.FORBIDDEN_403, ignoreCache: true })
    })

    it('Should succeed with the new token', async function () {
      const token = await servers[0].users.getMyScopedTokens({ token: userAccessToken })
      userFeedToken = token.feedToken

      const query = { accountId: userAccountId, token: userFeedToken }
      await servers[0].feed.getJSON({ feed: 'subscriptions', query, ignoreCache: true })
    })

  })

  describe('Cache', function () {
    const uuids: string[] = []

    function doPodcastRequest () {
      return makeGetRequest({
        url: servers[0].url,
        path: '/feeds/podcast/videos.xml',
        query: { videoChannelId: servers[0].store.channel.id },
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })
    }

    function doVideosRequest (query: { [id: string]: string } = {}) {
      return makeGetRequest({
        url: servers[0].url,
        path: '/feeds/videos.xml',
        query,
        accept: 'application/xml',
        expectedStatus: HttpStatusCode.OK_200
      })
    }

    before(async function () {
      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'cache 1' })
        uuids.push(uuid)
      }

      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'cache 2' })
        uuids.push(uuid)
      }
    })

    it('Should serve the videos endpoint as a cached request', async function () {
      await doVideosRequest()

      const res = await doVideosRequest()

      expect(res.headers['x-api-cache-cached']).to.equal('true')
    })

    it('Should not serve the videos endpoint as a cached request', async function () {
      const res = await doVideosRequest({ v: '186' })

      expect(res.headers['x-api-cache-cached']).to.not.exist
    })

    it('Should invalidate the podcast feed cache after video deletion', async function () {
      await doPodcastRequest()

      {
        const res = await doPodcastRequest()
        expect(res.headers['x-api-cache-cached']).to.exist
      }

      await servers[0].videos.remove({ id: uuids[0] })

      {
        const res = await doPodcastRequest()
        expect(res.headers['x-api-cache-cached']).to.not.exist
      }
    })

    it('Should invalidate the podcast feed cache after video deletion, even after server restart', async function () {
      this.timeout(120000)

      await doPodcastRequest()

      {
        const res = await doPodcastRequest()
        expect(res.headers['x-api-cache-cached']).to.exist
      }

      await servers[0].kill()
      await servers[0].run()

      await servers[0].videos.remove({ id: uuids[1] })

      const res = await doPodcastRequest()
      expect(res.headers['x-api-cache-cached']).to.not.exist
    })

  })

  after(async function () {
    await servers[0].plugins.uninstall({ npmName: 'peertube-plugin-test-podcast-custom-tags' })

    await cleanupTests([ ...servers, serverHLSOnly ])
  })
})
