/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  addVideoChannel,
  cleanupTests,
  createUser,
  flushAndRunServer,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../shared/extra-utils'
import { VideoPrivacy } from '../../shared/models/videos'

const expect = chai.expect

describe('Test misc endpoints', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(120000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  describe('Test a well known endpoints', function () {

    it('Should get security.txt', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/security.txt',
        statusCodeExpected: 200
      })

      expect(res.text).to.contain('security issue')
    })

    it('Should get nodeinfo', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/nodeinfo',
        statusCodeExpected: 200
      })

      expect(res.body.links).to.be.an('array')
      expect(res.body.links).to.have.lengthOf(1)
      expect(res.body.links[0].rel).to.equal('http://nodeinfo.diaspora.software/ns/schema/2.0')
    })

    it('Should get dnt policy text', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/dnt-policy.txt',
        statusCodeExpected: 200
      })

      expect(res.text).to.contain('http://www.w3.org/TR/tracking-dnt')
    })

    it('Should get dnt policy', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/dnt',
        statusCodeExpected: 200
      })

      expect(res.body.tracking).to.equal('N')
    })

    it('Should get change-password location', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/change-password',
        statusCodeExpected: 302
      })

      expect(res.header.location).to.equal('/my-account/settings')
    })
  })

  describe('Test classic static endpoints', function () {

    it('Should get robots.txt', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/robots.txt',
        statusCodeExpected: 200
      })

      expect(res.text).to.contain('User-agent')
    })

    it('Should get security.txt', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/security.txt',
        statusCodeExpected: 301
      })
    })

    it('Should get nodeinfo', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/nodeinfo/2.0.json',
        statusCodeExpected: 200
      })

      expect(res.body.software.name).to.equal('peertube')
    })
  })

  describe('Test bots endpoints', function () {

    it('Should get the empty sitemap', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml',
        statusCodeExpected: 200
      })

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/about/instance</loc></url>')
    })

    it('Should get the empty cached sitemap', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml',
        statusCodeExpected: 200
      })

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>http://localhost:' + server.port + '/about/instance</loc></url>')
    })

    it('Should add videos, channel and accounts and get sitemap', async function () {
      this.timeout(35000)

      await uploadVideo(server.url, server.accessToken, { name: 'video 1', nsfw: false })
      await uploadVideo(server.url, server.accessToken, { name: 'video 2', nsfw: false })
      await uploadVideo(server.url, server.accessToken, { name: 'video 3', privacy: VideoPrivacy.PRIVATE })

      await addVideoChannel(server.url, server.accessToken, { name: 'channel1', displayName: 'channel 1' })
      await addVideoChannel(server.url, server.accessToken, { name: 'channel2', displayName: 'channel 2' })

      await createUser({ url: server.url, accessToken: server.accessToken, username: 'user1', password: 'password' })
      await createUser({ url: server.url, accessToken: server.accessToken, username: 'user2', password: 'password' })

      const res = await makeGetRequest({
        url: server.url,
        path: '/sitemap.xml?t=1', // avoid using cache
        statusCodeExpected: 200
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
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
