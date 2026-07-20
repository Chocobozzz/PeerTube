/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'

describe('Test per-user rate limits', function () {
  let server: PeerTubeServer
  let user1Token: string
  let user2Token: string
  let videoId: number

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1, {
      rates_limit: {
        report_abuse: {
          window: '5 minutes',
          max: 3
        },
        create_comment: {
          window: '5 minutes',
          max: 3
        }
      }
    })
    await setAccessTokensToServers([ server ])

    user1Token = await server.users.generateUserAndToken('user1')
    user2Token = await server.users.generateUserAndToken('user2')

    const { id } = await server.videos.upload()
    videoId = id
  })

  describe('Abuse reports', function () {
    it('Should rate limit abuse reports of a user', async function () {
      for (let i = 0; i < 3; i++) {
        await server.abuses.report({ videoId, reason: 'abuse reason ' + i, token: user1Token })
      }

      await server.abuses.report({
        videoId,
        reason: 'abuse reason 4',
        token: user1Token,
        expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
      })
    })

    it('Should not limit abuse reports of another user', async function () {
      await server.abuses.report({ videoId, reason: 'abuse reason user 2', token: user2Token })
    })

    it('Should not limit abuse reports of an admin', async function () {
      for (let i = 0; i < 4; i++) {
        await server.abuses.report({ videoId, reason: 'admin abuse reason ' + i })
      }
    })
  })

  describe('Comments', function () {
    it('Should rate limit comments of a user', async function () {
      for (let i = 0; i < 3; i++) {
        await server.comments.createThread({ videoId, text: 'comment ' + i, token: user1Token })
      }

      await server.comments.createThread({
        videoId,
        text: 'comment 4',
        token: user1Token,
        expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
      })
    })

    it('Should also rate limit comment replies', async function () {
      const created = await server.comments.createThread({ videoId, text: 'thread of user 2', token: user2Token })

      await server.comments.addReply({
        videoId,
        toCommentId: created.id,
        text: 'reply',
        token: user1Token,
        expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
      })
    })

    it('Should not limit comments of another user', async function () {
      await server.comments.createThread({ videoId, text: 'comment of user 2', token: user2Token })
    })

    it('Should not limit comments of an admin', async function () {
      for (let i = 0; i < 4; i++) {
        await server.comments.createThread({ videoId, text: 'admin comment ' + i })
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
