/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { cleanupTests, getVideo, uploadVideo, userLogin, viewVideo, wait } from '../../../../shared/extra-utils'
import { flushAndRunServer, setAccessTokensToServers } from '../../../../shared/extra-utils/index'

const expect = chai.expect

describe('Test application behind a reverse proxy', function () {
  let server = null
  let videoId

  before(async function () {
    this.timeout(30000)
    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    const { body } = await uploadVideo(server.url, server.accessToken, {})
    videoId = body.video.uuid
  })

  it('Should view a video only once with the same IP by default', async function () {
    this.timeout(20000)

    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)

    // Wait the repeatable job
    await wait(8000)

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(1)
  })

  it('Should view a video 2 times with the X-Forwarded-For header set', async function () {
    this.timeout(20000)

    await viewVideo(server.url, videoId, 204, '0.0.0.1,127.0.0.1')
    await viewVideo(server.url, videoId, 204, '0.0.0.2,127.0.0.1')

    // Wait the repeatable job
    await wait(8000)

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(3)
  })

  it('Should view a video only once with the same client IP in the X-Forwarded-For header', async function () {
    this.timeout(20000)

    await viewVideo(server.url, videoId, 204, '0.0.0.4,0.0.0.3,::ffff:127.0.0.1')
    await viewVideo(server.url, videoId, 204, '0.0.0.5,0.0.0.3,127.0.0.1')

    // Wait the repeatable job
    await wait(8000)

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(4)
  })

  it('Should view a video two times with a different client IP in the X-Forwarded-For header', async function () {
    this.timeout(20000)

    await viewVideo(server.url, videoId, 204, '0.0.0.8,0.0.0.6,127.0.0.1')
    await viewVideo(server.url, videoId, 204, '0.0.0.8,0.0.0.7,127.0.0.1')

    // Wait the repeatable job
    await wait(8000)

    const { body } = await getVideo(server.url, videoId)
    expect(body.views).to.equal(6)
  })

  it('Should rate limit logins', async function () {
    const user = { username: 'root', password: 'fail' }

    for (let i = 0; i < 19; i++) {
      await userLogin(server, user, 400)
    }

    await userLogin(server, user, 429)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
