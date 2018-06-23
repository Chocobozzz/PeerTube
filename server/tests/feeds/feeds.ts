/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  getJSONfeed,
  getXMLfeed,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../utils'
import { join } from 'path'
import * as libxmljs from 'libxmljs'
import { addVideoCommentThread } from '../utils/videos/video-comments'
import { waitJobs } from '../utils/server/jobs'

chai.use(require('chai-xml'))
chai.use(require('chai-json-schema'))
chai.config.includeStack = true
const expect = chai.expect

describe('Test syndication feeds', () => {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const videoAttributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1',
      fixture: 'video_short.webm'
    }
    const res = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
    const videoId = res.body.video.id

    await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoId, 'super comment 1')
    await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoId, 'super comment 2')

    await waitJobs(servers)
  })

  describe('All feed', function () {

    it('Should be well formed XML (covers RSS 2.0 and ATOM 1.0 endpoints)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const rss = await getXMLfeed(servers[ 0 ].url, feed)
        expect(rss.text).xml.to.be.valid()

        const atom = await getXMLfeed(servers[ 0 ].url, feed, 'atom')
        expect(atom.text).xml.to.be.valid()
      }
    })

    it('Should be well formed JSON (covers JSON feed 1.0 endpoint)', async function () {
      for (const feed of [ 'video-comments' as 'video-comments', 'videos' as 'videos' ]) {
        const json = await getJSONfeed(servers[ 0 ].url, feed)
        expect(JSON.parse(json.text)).to.be.jsonSchema({ 'type': 'object' })
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
        expect(jsonObj.items.length).to.be.equal(1)
        expect(jsonObj.items[ 0 ].attachments).to.exist
        expect(jsonObj.items[ 0 ].attachments.length).to.be.eq(1)
        expect(jsonObj.items[ 0 ].attachments[ 0 ].mime_type).to.be.eq('application/x-bittorrent')
        expect(jsonObj.items[ 0 ].attachments[ 0 ].size_in_bytes).to.be.eq(218910)
        expect(jsonObj.items[ 0 ].attachments[ 0 ].url).to.contain('720.torrent')
      }
    })
  })

  describe('Video comments feed', function () {
    it('Should contain valid comments (covers JSON feed 1.0 endpoint)', async function () {
      for (const server of servers) {
        const json = await getJSONfeed(server.url, 'video-comments')

        const jsonObj = JSON.parse(json.text)
        expect(jsonObj.items.length).to.be.equal(2)
        expect(jsonObj.items[ 0 ].html_content).to.equal('super comment 2')
        expect(jsonObj.items[ 1 ].html_content).to.equal('super comment 1')
      }
    })
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
