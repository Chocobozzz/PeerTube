/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { About } from '../../../../shared/models/config/about.model'
import { deleteCustomConfig, getAbout, killallServers, reRunServer } from '../../utils'
const expect = chai.expect

import {
  getConfig,
  flushTests,
  runServer,
  registerUser, getCustomConfig, setAccessTokensToServers, updateCustomConfig
} from '../../utils/index'

describe('Test config', function () {
  let server = null

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should have a correct config on a server with registration enabled', async function () {
    const res = await getConfig(server.url)
    const data = res.body

    expect(data.signup.allowed).to.be.true
  })

  it('Should have a correct config on a server with registration enabled and a users limit', async function () {
    this.timeout(5000)

    await Promise.all([
      registerUser(server.url, 'user1', 'super password'),
      registerUser(server.url, 'user2', 'super password'),
      registerUser(server.url, 'user3', 'super password')
    ])

    const res = await getConfig(server.url)
    const data = res.body

    expect(data.signup.allowed).to.be.false
  })

  it('Should get the customized configuration', async function () {
    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    expect(data.instance.name).to.equal('PeerTube')
    expect(data.instance.description).to.be.empty
    expect(data.instance.terms).to.be.empty
    expect(data.cache.previews.size).to.equal(1)
    expect(data.signup.enabled).to.be.true
    expect(data.signup.limit).to.equal(4)
    expect(data.admin.email).to.equal('admin1@example.com')
    expect(data.user.videoQuota).to.equal(5242880)
    expect(data.transcoding.enabled).to.be.false
    expect(data.transcoding.threads).to.equal(2)
    expect(data.transcoding.resolutions['240p']).to.be.true
    expect(data.transcoding.resolutions['360p']).to.be.true
    expect(data.transcoding.resolutions['480p']).to.be.true
    expect(data.transcoding.resolutions['720p']).to.be.true
    expect(data.transcoding.resolutions['1080p']).to.be.true
  })

  it('Should update the customized configuration', async function () {
    const newCustomConfig = {
      instance: {
        name: 'PeerTube updated',
        description: 'my super description',
        terms: 'my super terms'
      },
      cache: {
        previews: {
          size: 2
        }
      },
      signup: {
        enabled: false,
        limit: 5
      },
      admin: {
        email: 'superadmin1@example.com'
      },
      user: {
        videoQuota: 5242881
      },
      transcoding: {
        enabled: true,
        threads: 1,
        resolutions: {
          '240p': false,
          '360p': true,
          '480p': true,
          '720p': false,
          '1080p': false
        }
      }
    }
    await updateCustomConfig(server.url, server.accessToken, newCustomConfig)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    expect(data.instance.name).to.equal('PeerTube updated')
    expect(data.instance.description).to.equal('my super description')
    expect(data.instance.terms).to.equal('my super terms')
    expect(data.cache.previews.size).to.equal(2)
    expect(data.signup.enabled).to.be.false
    expect(data.signup.limit).to.equal(5)
    expect(data.admin.email).to.equal('superadmin1@example.com')
    expect(data.user.videoQuota).to.equal(5242881)
    expect(data.transcoding.enabled).to.be.true
    expect(data.transcoding.threads).to.equal(1)
    expect(data.transcoding.resolutions['240p']).to.be.false
    expect(data.transcoding.resolutions['360p']).to.be.true
    expect(data.transcoding.resolutions['480p']).to.be.true
    expect(data.transcoding.resolutions['720p']).to.be.false
    expect(data.transcoding.resolutions['1080p']).to.be.false
  })

  it('Should have the configuration updated after a restart', async function () {
    this.timeout(10000)

    killallServers([ server ])

    await reRunServer(server)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    expect(data.instance.name).to.equal('PeerTube updated')
    expect(data.instance.description).to.equal('my super description')
    expect(data.instance.terms).to.equal('my super terms')
    expect(data.cache.previews.size).to.equal(2)
    expect(data.signup.enabled).to.be.false
    expect(data.signup.limit).to.equal(5)
    expect(data.admin.email).to.equal('superadmin1@example.com')
    expect(data.user.videoQuota).to.equal(5242881)
    expect(data.transcoding.enabled).to.be.true
    expect(data.transcoding.threads).to.equal(1)
    expect(data.transcoding.resolutions['240p']).to.be.false
    expect(data.transcoding.resolutions['360p']).to.be.true
    expect(data.transcoding.resolutions['480p']).to.be.true
    expect(data.transcoding.resolutions['720p']).to.be.false
    expect(data.transcoding.resolutions['1080p']).to.be.false
  })

  it('Should fetch the about information', async function () {
    const res = await getAbout(server.url)
    const data: About = res.body

    expect(data.instance.name).to.equal('PeerTube updated')
    expect(data.instance.description).to.equal('my super description')
    expect(data.instance.terms).to.equal('my super terms')
  })

  it('Should remove the custom configuration', async function () {
    this.timeout(10000)

    await deleteCustomConfig(server.url, server.accessToken)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    expect(data.cache.previews.size).to.equal(1)
    expect(data.signup.enabled).to.be.true
    expect(data.signup.limit).to.equal(4)
    expect(data.admin.email).to.equal('admin1@example.com')
    expect(data.user.videoQuota).to.equal(5242880)
    expect(data.transcoding.enabled).to.be.false
    expect(data.transcoding.threads).to.equal(2)
    expect(data.transcoding.resolutions['240p']).to.be.true
    expect(data.transcoding.resolutions['360p']).to.be.true
    expect(data.transcoding.resolutions['480p']).to.be.true
    expect(data.transcoding.resolutions['720p']).to.be.true
    expect(data.transcoding.resolutions['1080p']).to.be.true
  })

  after(async function () {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
