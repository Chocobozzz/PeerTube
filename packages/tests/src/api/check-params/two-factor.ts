/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  TwoFactorCommand
} from '@peertube/peertube-server-commands'

describe('Test two factor API validators', function () {
  let server: PeerTubeServer

  let rootId: number
  let rootPassword: string
  let rootRequestToken: string
  let rootOTPToken: string

  let userId: number
  let userToken = ''
  let userPassword: string
  let userRequestToken: string
  let userOTPToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    {
      server = await createSingleServer(1)
      await setAccessTokensToServers([ server ])
    }

    {
      const result = await server.users.generate('user1')
      userToken = result.token
      userId = result.userId
      userPassword = result.password
    }

    {
      const { id } = await server.users.getMyInfo()
      rootId = id
      rootPassword = server.store.user.password
    }
  })

  describe('When requesting two factor', function () {

    it('Should fail with an unknown user id', async function () {
      await server.twoFactor.request({ userId: 42, currentPassword: rootPassword, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an invalid user id', async function () {
      await server.twoFactor.request({
        userId: 'invalid' as any,
        currentPassword: rootPassword,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to request another user two factor without the appropriate rights', async function () {
      await server.twoFactor.request({
        userId: rootId,
        token: userToken,
        currentPassword: userPassword,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to request another user two factor with the appropriate rights', async function () {
      await server.twoFactor.request({ userId, currentPassword: rootPassword })
    })

    it('Should fail to request two factor without a password', async function () {
      await server.twoFactor.request({
        userId,
        token: userToken,
        currentPassword: undefined,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to request two factor with an incorrect password', async function () {
      await server.twoFactor.request({
        userId,
        token: userToken,
        currentPassword: rootPassword,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to request two factor without a password when targeting a remote user with an admin account', async function () {
      await server.twoFactor.request({ userId })
    })

    it('Should fail to request two factor without a password when targeting myself with an admin account', async function () {
      await server.twoFactor.request({ userId: rootId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.twoFactor.request({ userId: rootId, currentPassword: 'bad', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed to request my two factor auth', async function () {
      {
        const { otpRequest } = await server.twoFactor.request({ userId, token: userToken, currentPassword: userPassword })
        userRequestToken = otpRequest.requestToken
        userOTPToken = TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate()
      }

      {
        const { otpRequest } = await server.twoFactor.request({ userId: rootId, currentPassword: rootPassword })
        rootRequestToken = otpRequest.requestToken
        rootOTPToken = TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate()
      }
    })
  })

  describe('When confirming two factor request', function () {

    it('Should fail with an unknown user id', async function () {
      await server.twoFactor.confirmRequest({
        userId: 42,
        requestToken: rootRequestToken,
        otpToken: rootOTPToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an invalid user id', async function () {
      await server.twoFactor.confirmRequest({
        userId: 'invalid' as any,
        requestToken: rootRequestToken,
        otpToken: rootOTPToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to confirm another user two factor request without the appropriate rights', async function () {
      await server.twoFactor.confirmRequest({
        userId: rootId,
        token: userToken,
        requestToken: rootRequestToken,
        otpToken: rootOTPToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail without request token', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        requestToken: undefined,
        otpToken: userOTPToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an invalid request token', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        requestToken: 'toto',
        otpToken: userOTPToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with request token of another user', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        requestToken: rootRequestToken,
        otpToken: userOTPToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail without an otp token', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        requestToken: userRequestToken,
        otpToken: undefined,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad otp token', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        requestToken: userRequestToken,
        otpToken: '123456',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to confirm another user two factor request with the appropriate rights', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        requestToken: userRequestToken,
        otpToken: userOTPToken
      })

      // Reinit
      await server.twoFactor.disable({ userId, currentPassword: rootPassword })
    })

    it('Should succeed to confirm my two factor request', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        token: userToken,
        requestToken: userRequestToken,
        otpToken: userOTPToken
      })
    })

    it('Should fail to confirm again two factor request', async function () {
      await server.twoFactor.confirmRequest({
        userId,
        token: userToken,
        requestToken: userRequestToken,
        otpToken: userOTPToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('When disabling two factor', function () {

    it('Should fail with an unknown user id', async function () {
      await server.twoFactor.disable({
        userId: 42,
        currentPassword: rootPassword,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an invalid user id', async function () {
      await server.twoFactor.disable({
        userId: 'invalid' as any,
        currentPassword: rootPassword,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to disable another user two factor without the appropriate rights', async function () {
      await server.twoFactor.disable({
        userId: rootId,
        token: userToken,
        currentPassword: userPassword,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail to disable two factor with an incorrect password', async function () {
      await server.twoFactor.disable({
        userId,
        token: userToken,
        currentPassword: rootPassword,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to disable two factor without a password when targeting a remote user with an admin account', async function () {
      await server.twoFactor.disable({ userId })
      await server.twoFactor.requestAndConfirm({ userId })
    })

    it('Should fail to disable two factor without a password when targeting myself with an admin account', async function () {
      await server.twoFactor.disable({ userId: rootId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.twoFactor.disable({ userId: rootId, currentPassword: 'bad', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed to disable another user two factor with the appropriate rights', async function () {
      await server.twoFactor.disable({ userId, currentPassword: rootPassword })

      await server.twoFactor.requestAndConfirm({ userId })
    })

    it('Should succeed to update my two factor auth', async function () {
      await server.twoFactor.disable({ userId, token: userToken, currentPassword: userPassword })
    })

    it('Should fail to disable again two factor', async function () {
      await server.twoFactor.disable({
        userId,
        token: userToken,
        currentPassword: userPassword,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
