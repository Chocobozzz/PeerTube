/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers, wait } from '@shared/extra-utils'
import { HttpStatusCode } from '@shared/models'

describe('Test application behind a reverse proxy', function () {
  let server: PeerTubeServer
  let videoId: string

  before(async function () {
    this.timeout(30000)

    const config = {
      rates_limit: {
        api: {
          max: 50,
          window: 5000
        },
        signup: {
          max: 3,
          window: 5000
        },
        login: {
          max: 20
        }
      },
      signup: {
        limit: 20
      }
    }

    server = await createSingleServer(1, config)
    await setAccessTokensToServers([ server ])

    const { uuid } = await server.videos.upload()
    videoId = uuid
  })

  it('Should view a video only once with the same IP by default', async function () {
    this.timeout(20000)

    await server.videos.view({ id: videoId })
    await server.videos.view({ id: videoId })

    // Wait the repeatable job
    await wait(8000)

    const video = await server.videos.get({ id: videoId })
    expect(video.views).to.equal(1)
  })

  it('Should view a video 2 times with the X-Forwarded-For header set', async function () {
    this.timeout(20000)

    await server.videos.view({ id: videoId, xForwardedFor: '0.0.0.1,127.0.0.1' })
    await server.videos.view({ id: videoId, xForwardedFor: '0.0.0.2,127.0.0.1' })

    // Wait the repeatable job
    await wait(8000)

    const video = await server.videos.get({ id: videoId })
    expect(video.views).to.equal(3)
  })

  it('Should view a video only once with the same client IP in the X-Forwarded-For header', async function () {
    this.timeout(20000)

    await server.videos.view({ id: videoId, xForwardedFor: '0.0.0.4,0.0.0.3,::ffff:127.0.0.1' })
    await server.videos.view({ id: videoId, xForwardedFor: '0.0.0.5,0.0.0.3,127.0.0.1' })

    // Wait the repeatable job
    await wait(8000)

    const video = await server.videos.get({ id: videoId })
    expect(video.views).to.equal(4)
  })

  it('Should view a video two times with a different client IP in the X-Forwarded-For header', async function () {
    this.timeout(20000)

    await server.videos.view({ id: videoId, xForwardedFor: '0.0.0.8,0.0.0.6,127.0.0.1' })
    await server.videos.view({ id: videoId, xForwardedFor: '0.0.0.8,0.0.0.7,127.0.0.1' })

    // Wait the repeatable job
    await wait(8000)

    const video = await server.videos.get({ id: videoId })
    expect(video.views).to.equal(6)
  })

  it('Should rate limit logins', async function () {
    const user = { username: 'root', password: 'fail' }

    for (let i = 0; i < 19; i++) {
      await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    }

    await server.login.login({ user, expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
  })

  it('Should rate limit signup', async function () {
    for (let i = 0; i < 10; i++) {
      try {
        await server.users.register({ username: 'test' + i })
      } catch {
        // empty
      }
    }

    await server.users.register({ username: 'test42', expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
  })

  it('Should not rate limit failed signup', async function () {
    this.timeout(30000)

    await wait(7000)

    for (let i = 0; i < 3; i++) {
      await server.users.register({ username: 'test' + i, expectedStatus: HttpStatusCode.CONFLICT_409 })
    }

    await server.users.register({ username: 'test43', expectedStatus: HttpStatusCode.NO_CONTENT_204 })

  })

  it('Should rate limit API calls', async function () {
    this.timeout(30000)

    await wait(7000)

    for (let i = 0; i < 100; i++) {
      try {
        await server.videos.get({ id: videoId })
      } catch {
        // don't care if it fails
      }
    }

    await server.videos.get({ id: videoId, expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
