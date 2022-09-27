/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { cleanupTests, createSingleServer, makeGetRequest, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import { expectLogDoesNotContain } from './shared'

describe('Test misc endpoints', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
  })

  describe('Test a well known endpoints', function () {

    it('Should get security.txt', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/security.txt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('security issue')
    })

    it('Should get nodeinfo', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/nodeinfo',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.links).to.be.an('array')
      expect(res.body.links).to.have.lengthOf(1)
      expect(res.body.links[0].rel).to.equal('http://nodeinfo.diaspora.software/ns/schema/2.0')
    })

    it('Should get dnt policy text', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/dnt-policy.txt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('http://www.w3.org/TR/tracking-dnt')
    })

    it('Should get dnt policy', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/dnt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.tracking).to.equal('N')
    })

    it('Should get change-password location', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/change-password',
        expectedStatus: HttpStatusCode.FOUND_302
      })

      expect(res.header.location).to.equal('/my-account/settings')
    })

    it('Should test webfinger', async function () {
      const resource = 'acct:peertube@' + server.host
      const accountUrl = server.url + '/accounts/peertube'

      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/webfinger?resource=' + resource,
        expectedStatus: HttpStatusCode.OK_200
      })

      const data = res.body

      expect(data.subject).to.equal(resource)
      expect(data.aliases).to.contain(accountUrl)

      const self = data.links.find(l => l.rel === 'self')
      expect(self).to.exist
      expect(self.type).to.equal('application/activity+json')
      expect(self.href).to.equal(accountUrl)

      const remoteInteract = data.links.find(l => l.rel === 'http://ostatus.org/schema/1.0/subscribe')
      expect(remoteInteract).to.exist
      expect(remoteInteract.template).to.equal(server.url + '/remote-interaction?uri={uri}')
    })
  })

  describe('Test classic static endpoints', function () {

    it('Should get robots.txt', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/robots.txt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('User-agent')
    })

    it('Should get security.txt', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/security.txt',
        expectedStatus: HttpStatusCode.MOVED_PERMANENTLY_301
      })
    })

    it('Should get nodeinfo', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/nodeinfo/2.0.json',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.software.name).to.equal('peertube')
      expect(res.body.usage.users.activeMonth).to.equal(1)
      expect(res.body.usage.users.activeHalfyear).to.equal(1)
    })
  })

  describe('Test bots endpoints', function () {

    it('Should get the empty sitemap', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/about/instance</loc></url>')
    })

    it('Should get the empty cached sitemap', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/about/instance</loc></url>')
    })

    it('Should add videos, channel and accounts and get sitemap', async function () {
      this.timeout(35000)

      await server.videos.upload({ attributes: { name: 'video 1', nsfw: false } })
      await server.videos.upload({ attributes: { name: 'video 2', nsfw: false } })
      await server.videos.upload({ attributes: { name: 'video 3', privacy: VideoPrivacy.PRIVATE } })

      await server.channels.create({ attributes: { name: 'channel1', displayName: 'channel 1' } })
      await server.channels.create({ attributes: { name: 'channel2', displayName: 'channel 2' } })

      await server.users.create({ username: 'user1', password: 'password' })
      await server.users.create({ username: 'user2', password: 'password' })

      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml?t=1', // avoid using cache
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/about/instance</loc></url>')

      expect(res.text).to.contain('<video:title>video 1</video:title>')
      expect(res.text).to.contain('<video:title>video 2</video:title>')
      expect(res.text).to.not.contain('<video:title>video 3</video:title>')

      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/video-channels/channel1</loc></url>')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/video-channels/channel2</loc></url>')

      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/accounts/user1</loc></url>')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/accounts/user2</loc></url>')
    })

    it('Should not fail with big title/description videos', async function () {
      const name = 'v'.repeat(115)

      await server.videos.upload({ attributes: { name, description: 'd'.repeat(2500), nsfw: false } })

      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml?t=2', // avoid using cache
        expectedStatus: HttpStatusCode.OK_200
      })

      await expectLogDoesNotContain(server, 'Warning in sitemap generation')
      await expectLogDoesNotContain(server, 'Error in sitemap generation')

      expect(res.text).to.contain(`<video:title>${'v'.repeat(97)}...</video:title>`)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
