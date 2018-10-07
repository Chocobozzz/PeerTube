/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { flushTests, killallServers, makeGetRequest, runServer, ServerInfo } from './utils'

const expect = chai.expect

describe('Test misc endpoints', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)
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

  after(async function () {
    killallServers([ server ])
  })
})
