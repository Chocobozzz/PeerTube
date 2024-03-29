/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

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
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'

describe('Test watched words API validators', function () {
  let server: PeerTubeServer

  let userToken: string
  let userToken2: string
  let moderatorToken: string

  let command: WatchedWordsCommand

  let accountListId: number
  let serverListId: number

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultAccountAvatar([ server ])

    userToken = await server.users.generateUserAndToken('user1')
    userToken2 = await server.users.generateUserAndToken('user2')
    moderatorToken = await server.users.generateUserAndToken('moderator', UserRole.MODERATOR)

    command = server.watchedWordsLists

    {
      const { watchedWordsList } = await command.createList({
        accountName: 'user1',
        token: userToken,
        listName: 'default',
        words: [ 'word1' ]
      })
      accountListId = watchedWordsList.id
    }

    {
      const { watchedWordsList } = await command.createList({
        listName: 'default',
        words: [ 'word1' ]
      })
      serverListId = watchedWordsList.id
    }
  })

  describe('Account & server watched words', function () {

    describe('When listing watched words', function () {
      const paths = [
        '/api/v1/watched-words/accounts/user1/lists',
        '/api/v1/watched-words/server/lists'
      ]

      it('Should fail with an unauthenticated user', async function () {
        for (const path of paths) {
          await makeGetRequest({
            url: server.url,
            path,
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        }
      })

      it('Should fail with the wrong token', async function () {
        for (const path of paths) {
          await makeGetRequest({
            url: server.url,
            token: userToken2,
            path,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        }
      })

      it('Should fail with a bad start/count pagination or incorrect sort', async function () {
        for (const path of paths) {
          await checkBadStartPagination(server.url, path, userToken)
          await checkBadCountPagination(server.url, path, userToken)
          await checkBadSortPagination(server.url, path, userToken)
        }
      })
    })

    describe('When adding/updating watched words', function () {
      const baseParams = () => ([
        {
          token: userToken,
          accountName: 'user1',
          listName: 'list',
          words: [ 'word1' ],
          listId: accountListId
        },
        {
          token: moderatorToken,
          listName: 'list',
          words: [ 'word1' ],
          listId: serverListId
        }
      ])

      it('Should fail with an unauthenticated user', async function () {
        for (const baseParam of baseParams()) {
          await command.createList({ ...baseParam, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
          await command.updateList({ ...baseParam, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
        }
      })

      it('Should fail with the wrong token', async function () {
        for (const baseParam of baseParams()) {
          await command.createList({ ...baseParam, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
          await command.updateList({ ...baseParam, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        }
      })

      it('Should fail with an invalid listName', async function () {
        for (const baseParam of baseParams()) {
          await command.createList({ ...baseParam, listName: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

          for (const listName of [ '', 'a'.repeat(500) ]) {
            await command.createList({ ...baseParam, listName, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
            await command.updateList({ ...baseParam, listName, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
          }
        }
      })

      it('Should fail with invalid words', async function () {
        const bigArray: string[] = []
        for (let i = 0; i < 550; i++) {
          bigArray.push(`word${i}`)
        }

        const toTest = [
          [],
          bigArray,
          [ 'a'.repeat(102) ],
          [ '' ],
          [ '', 'word' ]
        ]

        for (const baseParam of baseParams()) {
          await command.createList({ ...baseParam, words: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

          for (const words of toTest) {
            await command.createList({ ...baseParam, words, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
            await command.updateList({ ...baseParam, words, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
          }
        }
      })

      it('Should succeed with the correct params', async function () {
        for (const baseParam of baseParams()) {
          await command.createList(baseParam)
          await command.updateList({ ...baseParam, listName: 'updated-list' })
        }
      })

      it('Should succeed to update a list with the same name', async function () {
        for (const baseParam of baseParams()) {
          await command.updateList({ ...baseParam, listName: 'updated-list' })
        }
      })

      it('Should fail to add a list with an already existing name', async function () {
        for (const baseParam of baseParams()) {
          await command.createList({ ...baseParam, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
          await command.updateList({ ...baseParam, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        }
      })
    })

    describe('When deleting watched words', function () {
      const baseParams = () => ([
        {
          token: userToken,
          accountName: 'user1',
          listId: accountListId
        },
        {
          token: moderatorToken,
          listId: serverListId
        }
      ])

      it('Should fail with an unauthenticated user', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteList({ ...baseParam, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
        }
      })

      it('Should fail with the wrong token', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteList({ ...baseParam, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        }
      })

      it('Should succeed with the correct params', async function () {
        for (const baseParam of baseParams()) {
          await command.deleteList(baseParam)
        }
      })
    })
  })

  describe('Account specific watched words', function () {

    describe('When listing watched words', function () {
      it('Should fail with an unknown account', async function () {
        await command.listWordsLists({ accountName: 'unknown', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('When adding/updating watched words', function () {
      const baseParams = () => ({
        token: userToken,
        accountName: 'user1',
        listName: 'list',
        words: [ 'word1' ]
      })

      it('Should fail with an unknown account', async function () {
        await command.createList({ ...baseParams(), accountName: 'unknown', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('When deleting watched words', function () {
      const baseParams = () => ({
        listId: accountListId,
        token: userToken,
        accountName: 'user1'
      })

      it('Should fail with an unknown account', async function () {
        await command.deleteList({ ...baseParams(), accountName: 'unknown', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
