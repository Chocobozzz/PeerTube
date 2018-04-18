/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  getOEmbed,
  getXMLfeed,
  getJSONfeed,
  flushTests,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  flushAndRunMultipleServers,
  wait
} from '../../utils'
import { runServer } from '../../utils/server/servers'
import { join } from 'path'
import * as libxmljs from 'libxmljs'

chai.use(require('chai-xml'))
chai.use(require('chai-json-schema'))
chai.config.includeStack = true
const expect = chai.expect

describe('Test instance-wide syndication feeds', () => {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    this.timeout(60000)

    const videoAttributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1',
      fixture: 'video_short.webm'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await wait(10000)
  })

  it('should be well formed XML (covers RSS 2.0 and ATOM 1.0 endpoints)', async function () {
    const rss = await getXMLfeed(servers[0].url)
    expect(rss.text).xml.to.be.valid()

    const atom = await getXMLfeed(servers[0].url, 'atom')
    expect(atom.text).xml.to.be.valid()
  })

  it('should be well formed JSON (covers JSON feed 1.0 endpoint)', async function () {
    const json = await getJSONfeed(servers[0].url)
    expect(JSON.parse(json.text)).to.be.jsonSchema({ 'type': 'object' })
  })

  it('should contain a valid enclosure (covers RSS 2.0 endpoint)', async function () {
    const rss = await getXMLfeed(servers[0].url)
    const xmlDoc = libxmljs.parseXmlString(rss.text)
    const xmlEnclosure = xmlDoc.get('/rss/channel/item/enclosure')
    expect(xmlEnclosure).to.exist
    expect(xmlEnclosure.attr('type').value()).to.be.equal('application/x-bittorrent')
    expect(xmlEnclosure.attr('length').value()).to.be.equal('218910')
    expect(xmlEnclosure.attr('url').value()).to.contain('720.torrent')
  })

  it('should contain a valid \'attachments\' object (covers JSON feed 1.0 endpoint)', async function () {
    const json = await getJSONfeed(servers[0].url)
    const jsonObj = JSON.parse(json.text)
    expect(jsonObj.items.length).to.be.equal(1)
    expect(jsonObj.items[0].attachments).to.exist
    expect(jsonObj.items[0].attachments.length).to.be.eq(1)
    expect(jsonObj.items[0].attachments[0].mime_type).to.be.eq('application/x-bittorrent')
    expect(jsonObj.items[0].attachments[0].size_in_bytes).to.be.eq(218910)
    expect(jsonObj.items[0].attachments[0].url).to.contain('720.torrent')
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
