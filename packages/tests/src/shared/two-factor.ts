/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import { PeerTubeServer, TwoFactorCommand } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { expectStartWith } from './checks.js'

export type TwoFactorTestUser = {
  server: PeerTubeServer
  userId: number
  token: string
  username: string
  password: string
}

export function runTwoFactorTests (user: TwoFactorTestUser) {
  let otpSecret: string
  let requestToken: string

  function login (options: {
    password?: string
    otpToken?: string
    expectedStatus?: HttpStatusCodeType
  }) {
    const { password = user.password, otpToken, expectedStatus } = options

    return user.server.login.loginAndGetResponse({ user: { username: user.username, password }, otpToken, expectedStatus })
      .then(({ res, body }) => ({ res, token: body.access_token }))
  }

  it('Should not add the header on login if two factor is not enabled', async function () {
    const { res, token } = await login({})

    expect(res.header['x-peertube-otp']).to.not.exist

    await user.server.users.getMyInfo({ token })
  })

  it('Should not request two factor with an incorrect password', async function () {
    await user.server.twoFactor.request({
      userId: user.userId,
      token: user.token,
      currentPassword: 'incorrect password',
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should request two factor and get the secret and uri', async function () {
    const { otpRequest } = await user.server.twoFactor.request({ userId: user.userId, token: user.token, currentPassword: user.password })

    expect(otpRequest.requestToken).to.exist

    expect(otpRequest.secret).to.exist
    expect(otpRequest.secret).to.have.lengthOf(32)

    expect(otpRequest.uri).to.exist
    expectStartWith(otpRequest.uri, 'otpauth://')
    expect(otpRequest.uri).to.include(otpRequest.secret)

    requestToken = otpRequest.requestToken
    otpSecret = otpRequest.secret
  })

  it('Should not have two factor confirmed yet', async function () {
    const { twoFactorEnabled } = await user.server.users.getMyInfo({ token: user.token })
    expect(twoFactorEnabled).to.be.false
  })

  it('Should confirm two factor', async function () {
    await user.server.twoFactor.confirmRequest({
      userId: user.userId,
      token: user.token,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpSecret }).generate(),
      requestToken
    })
  })

  it('Should not add the header on login if two factor is enabled and password is incorrect', async function () {
    const { res, token } = await login({ password: 'fake', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should add the header on login if two factor is enabled and password is correct', async function () {
    const { res, token } = await login({ expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

    expect(res.header['x-peertube-otp']).to.exist
    expect(token).to.not.exist
  })

  it('Should not login with correct password and incorrect otp secret', async function () {
    const otp = TwoFactorCommand.buildOTP({ secret: 'a'.repeat(32) })

    const { res, token } = await login({ otpToken: otp.generate(), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should not login with correct password and incorrect otp code', async function () {
    const { res, token } = await login({ otpToken: '123456', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should not login with incorrect password and correct otp code', async function () {
    const otpToken = TwoFactorCommand.buildOTP({ secret: otpSecret }).generate()

    const { res, token } = await login({ password: 'fake', otpToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should correctly login with correct password and otp code', async function () {
    const otpToken = TwoFactorCommand.buildOTP({ secret: otpSecret }).generate()

    const { res, token } = await login({ otpToken })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.exist

    await user.server.users.getMyInfo({ token })
  })

  it('Should have two factor enabled when getting my info', async function () {
    const { twoFactorEnabled } = await user.server.users.getMyInfo({ token: user.token })
    expect(twoFactorEnabled).to.be.true
  })

  it('Should not disable two factor with an incorrect password', async function () {
    await user.server.twoFactor.disable({
      userId: user.userId,
      token: user.token,
      currentPassword: 'incorrect password',
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should disable two factor and be able to login without otp token', async function () {
    await user.server.twoFactor.disable({ userId: user.userId, token: user.token, currentPassword: user.password })

    const { res, token } = await login({})
    expect(res.header['x-peertube-otp']).to.not.exist

    await user.server.users.getMyInfo({ token })
  })

  it('Should have two factor disabled when getting my info', async function () {
    const { twoFactorEnabled } = await user.server.users.getMyInfo({ token: user.token })
    expect(twoFactorEnabled).to.be.false
  })

  it('Should enable two factor auth without password from an admin', async function () {
    const { otpRequest } = await user.server.twoFactor.request({ userId: user.userId })

    await user.server.twoFactor.confirmRequest({
      userId: user.userId,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate(),
      requestToken: otpRequest.requestToken
    })

    const { twoFactorEnabled } = await user.server.users.getMyInfo({ token: user.token })
    expect(twoFactorEnabled).to.be.true
  })

  it('Should disable two factor auth without password from an admin', async function () {
    await user.server.twoFactor.disable({ userId: user.userId })

    const { twoFactorEnabled } = await user.server.users.getMyInfo({ token: user.token })
    expect(twoFactorEnabled).to.be.false
  })
}
