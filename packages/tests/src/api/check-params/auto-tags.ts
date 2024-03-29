/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer, setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test auto tag policies API validator', function () {
  let server: PeerTubeServer

  let userToken: string
  let userToken2: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    userToken = await server.users.generateUserAndToken('user1')
    userToken2 = await server.users.generateUserAndToken('user2')
  })

  describe('When getting available account auto tags', function () {
    const baseParams = () => ({ accountName: 'user1', token: userToken })

    it('Should fail without token', async function () {
      await server.autoTags.getAccountAvailable({ ...baseParams(), token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a user that cannot manage account', async function () {
      await server.autoTags.getAccountAvailable({ ...baseParams(), token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an unknown account', async function () {
      await server.autoTags.getAccountAvailable({ ...baseParams(), accountName: 'user42', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await server.autoTags.getAccountAvailable(baseParams())
    })
  })

  describe('When getting available server auto tags', function () {

    it('Should fail without token', async function () {
      await server.autoTags.getServerAvailable({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a user that that does not have enought rights', async function () {
      await server.autoTags.getServerAvailable({ token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      await server.autoTags.getServerAvailable()
    })
  })

  describe('When getting auto tag policies', function () {
    const baseParams = () => ({ accountName: 'user1', token: userToken })

    it('Should fail without token', async function () {
      await server.autoTags.getCommentPolicies({ ...baseParams(), token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a user that cannot manage account', async function () {
      await server.autoTags.getCommentPolicies({ ...baseParams(), token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an unknown account', async function () {
      await server.autoTags.getCommentPolicies({ ...baseParams(), accountName: 'user42', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await server.autoTags.getCommentPolicies(baseParams())
    })
  })

  describe('When updating auto tag policies', function () {
    const baseParams = () => ({ accountName: 'user1', review: [ 'external-link' ], token: userToken })

    it('Should fail without token', async function () {
      await server.autoTags.updateCommentPolicies({
        ...baseParams(),
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a user that cannot manage account', async function () {
      await server.autoTags.updateCommentPolicies({
        ...baseParams(),
        token: userToken2,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an unknown account', async function () {
      await server.autoTags.updateCommentPolicies({
        ...baseParams(),
        accountName: 'user42',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with invalid review array', async function () {
      await server.autoTags.updateCommentPolicies({
        ...baseParams(),
        review: 'toto' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with review array that does not contain available tags', async function () {
      await server.autoTags.updateCommentPolicies({
        ...baseParams(),
        review: [ 'toto' ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct params', async function () {
      await server.autoTags.updateCommentPolicies(baseParams())
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
