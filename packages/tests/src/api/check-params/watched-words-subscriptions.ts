/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  WatchedWordsCommand,
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  setAccessTokensToServers,
  setDefaultAccountAvatar
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { MockWatchedWords } from '@tests/shared/mock-servers/mock-watched-words.js'

describe('Test watched words subscriptions API validators', function () {
  let server: PeerTubeServer
  let mockServer: MockWatchedWords
  let mockPort: number

  let userToken: string
  let userToken2: string
  let moderatorToken: string

  let command: WatchedWordsCommand

  let accountSubscriptionId: number
  let serverSubscriptionId: number

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultAccountAvatar([ server ])

    mockServer = new MockWatchedWords()
    mockServer.setActions([
      {
        type: 'add',
        word: 'word 1',
        createdAt: new Date().toISOString()
      }
    ])
    mockPort = await mockServer.initialize()

    userToken = await server.users.generateUserAndToken('user1')
    userToken2 = await server.users.generateUserAndToken('user2')
    moderatorToken = await server.users.generateUserAndToken('moderator', UserRole.MODERATOR)

    command = server.watchedWordsLists

    {
      const subscription = await command.createSubscription({
        accountName: 'user1',
        token: userToken,
        subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`
      })

      accountSubscriptionId = subscription.id
    }

    {
      const subscription = await command.createSubscription({
        token: moderatorToken,
        subscriptionUrl: `http://127.0.0.1:${mockPort}/list-3`
      })

      serverSubscriptionId = subscription.id
    }
  })

  describe('Account specific watched words subscriptions', function () {
    it('Should fail with an unknown account when listing subscriptions', async function () {
      await command.listWordsSubscriptions({ accountName: 'unknown', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an unknown account when adding subscriptions', async function () {
      await command.createSubscription({
        token: userToken,
        accountName: 'unknown',
        subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an unknown account when deleting subscriptions', async function () {
      await command.deleteSubscription({
        token: userToken,
        accountName: 'unknown',
        id: accountSubscriptionId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })
  })

  describe('Account & server watched words subscriptions', function () {
    describe('When listing subscriptions', function () {
      const paths = () => [
        { path: '/api/v1/watched-words/accounts/user1/subscriptions', token: userToken },
        { path: '/api/v1/watched-words/server/subscriptions', token: moderatorToken }
      ]

      it('Should fail with an unauthenticated user', async function () {
        for (const { path } of paths()) {
          await makeGetRequest({
            url: server.url,
            path,
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        }
      })

      it('Should fail with the wrong token', async function () {
        for (const { path } of paths()) {
          await makeGetRequest({
            url: server.url,
            token: userToken2,
            path,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        }
      })

      it('Should fail with a bad start/count pagination or incorrect sort', async function () {
        for (const { path, token } of paths()) {
          await checkBadStartPagination(server.url, path, token)
          await checkBadCountPagination(server.url, path, token)
          await checkBadSort(server.url, path, token)
        }
      })

      it('Should succeed with the right token', async function () {
        for (const { path, token } of paths()) {
          await makeGetRequest({ url: server.url, token, path, expectedStatus: HttpStatusCode.OK_200 })
        }
      })
    })

    describe('When adding subscriptions', function () {
      const baseParams = () => [
        {
          token: userToken,
          accountName: 'user1',
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list-3`
        },
        {
          token: moderatorToken,
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`
        }
      ]

      it('Should fail with an unauthenticated user', async function () {
        for (const baseParam of baseParams()) {
          await command.createSubscription({ ...baseParam, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
        }
      })

      it('Should fail with the wrong token', async function () {
        for (const baseParam of baseParams()) {
          await command.createSubscription({ ...baseParam, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        }
      })

      it('Should fail with an invalid URL', async function () {
        for (const baseParam of baseParams()) {
          await command.createSubscription({ ...baseParam, subscriptionUrl: 'invalid', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        }
      })

      it('Should fail with an URL that does not have the right format', async function () {
        for (const baseParam of baseParams()) {
          await command.createSubscription({
            ...baseParam,
            subscriptionUrl: `http://127.0.0.1:${mockPort}/invalid-watched-words-1`,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })

          await command.createSubscription({
            ...baseParam,
            subscriptionUrl: `http://127.0.0.1:${mockPort}/invalid-watched-words-2`,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        }
      })

      it('Should succeed with the correct parameters', async function () {
        for (const baseParam of baseParams()) {
          await command.createSubscription(baseParam)
        }
      })

      it('Should fail with an already existing URL', async function () {
        await command.createSubscription({
          token: userToken,
          accountName: 'user1',
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })

        await command.createSubscription({
          token: moderatorToken,
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list-3`,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      })

      it('Should fail with an already existing list name', async function () {
        await wait(6000)

        await command.createSubscription({
          token: userToken,
          accountName: 'user1',
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list-copy.json`,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })

        await command.createSubscription({
          token: moderatorToken,
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list-3-copy`,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      })
    })

    describe('When deleting subscriptions', function () {
      const baseParams = () => [
        {
          token: userToken,
          accountName: 'user1',
          id: accountSubscriptionId
        },
        {
          token: moderatorToken,
          id: serverSubscriptionId
        }
      ]

      it('Should fail with an unauthenticated user', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteSubscription({ ...baseParam, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
        }
      })

      it('Should fail with the wrong token', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteSubscription({ ...baseParam, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        }
      })

      it('Should fail with an invalid id', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteSubscription({ ...baseParam, id: 'invalid', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        }
      })

      it('Should fail with an unknown id', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteSubscription({ ...baseParam, id: 999999, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        }
      })

      it('Should succeed with the correct parameters', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteSubscription(baseParam)
        }
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
    await mockServer.terminate()
  })
})
