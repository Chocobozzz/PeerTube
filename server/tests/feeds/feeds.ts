/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import * as libxmljs from 'libxmljs'
import {
  addAccountToAccountBlocklist,
  addAccountToServerBlocklist,
  removeAccountFromServerBlocklist
} from '@shared/extra-utils/users/blocklist'
import { VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getJSONfeed,
  getMyUserInformation,
  getXMLfeed,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  uploadVideoAndGetId,
  userLogin
} from '../../../shared/extra-utils'
import { waitJobs } from '../../../shared/extra-utils/server/jobs'
import { addVideoCommentThread } from '../../../shared/extra-utils/videos/video-comments'
import { User } from '../../../shared/models/users'

chai.use(require('chai-xml'))
chai.use(require('chai-json-schema'))
chai.config.includeStack = true
const expect = chai.expect

describe('Test syndication feeds', () => {
  let servers: ServerInfo[] = []
  let userAccessToken: string
  let rootAccountId: number
  let rootChannelId: number
  let userAccountId: number
  let userChannelId: number

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
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
        const rss = await getXMLfeed(servers[0].url, feed)
        expect(rss.text).xml.to.be.valid()

        const atom = await getXMLfeed(servers[0].url, feed, 'atom')
        expect(atom.text).xml.to.be.valid()
      }
    })

    it('Should be well formed JSON (covers JSON feed 1.0 endpoint)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const json = await getJSONfeed(servers[0].url, feed)
        expect(JSON.parse(json.text)).to.be.jsonSchema({ type: 'object' })
      }
    })
  })

  describe('Videos feed', function () {
    it('Should contain a valid enclosure (covers RSS 2.0 endpoint)', async function () {
      for (const server of servers) {
        const rss = await getXMLfeed(server.url, 'videos')
        const xmlDoc = libxmljs.parseXmlString(rss.text)
        const xmlEnclosure = xmlDoc.get('/rss/channel/item/enclosure')
        expect(xmlEnclosure).to.exist
        expect(xmlEnclosure.attr('type').value()).to.be.equal('application/x-bittorrent')
        expect(xmlEnclosure.attr('length').value()).to.be.equal('218910')
        expect(xmlEnclosure.attr('url').value()).to.contain('720.torrent')
      }
    })

    it('Should contain a valid \'attachments\' object (covers JSON feed 1.0 endpoint)', async function () {
      for (const server of servers) {
        const json = await getJSONfeed(server.url, 'videos')
        const jsonObj = JSON.parse(json.text)
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
        const json = await getJSONfeed(servers[0].url, 'videos', { accountId: rootAccountId })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[0].author.name).to.equal('root')
      }

      {
        const json = await getJSONfeed(servers[0].url, 'videos', { accountId: userAccountId })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('user video')
        expect(jsonObj.items[0].author.name).to.equal('john')
      }

      for (const server of servers) {
        {
          const json = await getJSONfeed(server.url, 'videos', { accountName: 'root@localhost:' + servers[0].port })
          const jsonObj = JSON.parse(json.text)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        }

        {
          const json = await getJSONfeed(server.url, 'videos', { accountName: 'john@localhost:' + servers[0].port })
          const jsonObj = JSON.parse(json.text)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
        }
      }
    })

    it('Should filter by video channel', async function () {
      {
        const json = await getJSONfeed(servers[0].url, 'videos', { videoChannelId: rootChannelId })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        expect(jsonObj.items[0].author.name).to.equal('root')
      }

      {
        const json = await getJSONfeed(servers[0].url, 'videos', { videoChannelId: userChannelId })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[0].title).to.equal('user video')
        expect(jsonObj.items[0].author.name).to.equal('john')
      }

      for (const server of servers) {
        {
          const json = await getJSONfeed(server.url, 'videos', { videoChannelName: 'root_channel@localhost:' + servers[0].port })
          const jsonObj = JSON.parse(json.text)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('my super name for server 1')
        }

        {
          const json = await getJSONfeed(server.url, 'videos', { videoChannelName: 'john_channel@localhost:' + servers[0].port })
          const jsonObj = JSON.parse(json.text)
          expect(jsonObj.items.length).to.be.equal(1)
          expect(jsonObj.items[0].title).to.equal('user video')
        }
      }
    })
  })

  describe('Video comments feed', function () {

    it('Should contain valid comments (covers JSON feed 1.0 endpoint) and not from unlisted videos', async function () {
      for (const server of servers) {
        const json = await getJSONfeed(server.url, 'video-comments')

        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[0].html_content).to.equal('super comment 2')
        expect(jsonObj.items[1].html_content).to.equal('super comment 1')
      }
    })

    it('Should not list comments from muted accounts or instances', async function () {
      this.timeout(30000)

      const remoteHandle = 'root@localhost:' + servers[0].port

      await addAccountToServerBlocklist(servers[1].url, servers[1].accessToken, remoteHandle)

      {
        const json = await getJSONfeed(servers[1].url, 'video-comments', { version: 2 })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(0)
      }

      await removeAccountFromServerBlocklist(servers[1].url, servers[1].accessToken, remoteHandle)

      {
        const videoUUID = (await uploadVideoAndGetId({ server: servers[1], videoName: 'server 2' })).uuid
        await waitJobs(servers)
        await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'super comment')
        await waitJobs(servers)

        const json = await getJSONfeed(servers[1].url, 'video-comments', { version: 3 })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(3)
      }

      await addAccountToAccountBlocklist(servers[1].url, servers[1].accessToken, remoteHandle)

      {
        const json = await getJSONfeed(servers[1].url, 'video-comments', { version: 4 })
        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(2)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
