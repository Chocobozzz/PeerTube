/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { About } from '../../../../shared/models/server/about.model'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'
import { deleteCustomConfig, getAbout, getVideo, killallServers, login, reRunServer, uploadVideo, userLogin, viewVideo } from '../../utils'
const expect = chai.expect

import {
  getConfig,
  flushTests,
  runServer,
  registerUser, getCustomConfig, setAccessTokensToServers, updateCustomConfig
} from '../../utils/index'

describe('Test application behind a reverse proxy', function () {
  let server = null
  let videoId

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)
    await setAccessTokensToServers([ server ])

    const { body } = await uploadVideo(server.url, server.accessToken, {})
    videoId = body.video.uuid
  })

  it('Should view a video only once with the same IP by default', async function () {
    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(1)
  })

  it('Should view a video 2 times with the X-Forwarded-For header set', async function () {
    await viewVideo(server.url, videoId, 204, '0.0.0.1,127.0.0.1')
    await viewVideo(server.url, videoId, 204, '0.0.0.2,127.0.0.1')

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(3)
  })

  it('Should view a video only once with the same client IP in the X-Forwarded-For header', async function () {
    await viewVideo(server.url, videoId, 204, '0.0.0.4,0.0.0.3,::ffff:127.0.0.1')
    await viewVideo(server.url, videoId, 204, '0.0.0.5,0.0.0.3,127.0.0.1')

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(4)
  })

  it('Should view a video two times with a different client IP in the X-Forwarded-For header', async function () {
    await viewVideo(server.url, videoId, 204, '0.0.0.8,0.0.0.6,127.0.0.1')
    await viewVideo(server.url, videoId, 204, '0.0.0.8,0.0.0.7,127.0.0.1')

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(6)
  })

  it('Should rate limit logins', async function () {
    const user = { username: 'root', password: 'fail' }

    for (let i = 0; i < 14; i++) {
      await userLogin(server, user, 400)
    }

    await userLogin(server, user, 429)
  })

  after(async function () {
    killallServers([ server ])
  })
})
