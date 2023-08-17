/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import { expectStartWith } from '@tests/shared/checks.js'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  TwoFactorCommand
} from '@peertube/peertube-server-commands'

async function login (options: {
  server: PeerTubeServer
  username: string
  password: string
  otpToken?: string
  expectedStatus?: HttpStatusCodeType
}) {
  const { server, username, password, otpToken, expectedStatus } = options

  const user = { username, password }
  const { res, body: { access_token: token } } = await server.login.loginAndGetResponse({ user, otpToken, expectedStatus })

  return { res, token }
}

describe('Test users', function () {
  let server: PeerTubeServer
  let otpSecret: string
  let requestToken: string

  const userUsername = 'user1'
  let userId: number
  let userPassword: string
  let userToken: string

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    const res = await server.users.generate(userUsername)
    userId = res.userId
    userPassword = res.password
    userToken = res.token
  })

  it('Should not add the header on login if two factor is not enabled', async function () {
    const { res, token } = await login({ server, username: userUsername, password: userPassword })

    expect(res.header['x-peertube-otp']).to.not.exist

    await server.users.getMyInfo({ token })
  })

  it('Should request two factor and get the secret and uri', async function () {
    const { otpRequest } = await server.twoFactor.request({ userId, token: userToken, currentPassword: userPassword })

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
    const { twoFactorEnabled } = await server.users.getMyInfo({ token: userToken })
    expect(twoFactorEnabled).to.be.false
  })

  it('Should confirm two factor', async function () {
    await server.twoFactor.confirmRequest({
      userId,
      token: userToken,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpSecret }).generate(),
      requestToken
    })
  })

  it('Should not add the header on login if two factor is enabled and password is incorrect', async function () {
    const { res, token } = await login({ server, username: userUsername, password: 'fake', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should add the header on login if two factor is enabled and password is correct', async function () {
    const { res, token } = await login({
      server,
      username: userUsername,
      password: userPassword,
      expectedStatus: HttpStatusCode.UNAUTHORIZED_401
    })

    expect(res.header['x-peertube-otp']).to.exist
    expect(token).to.not.exist

    await server.users.getMyInfo({ token })
  })

  it('Should not login with correct password and incorrect otp secret', async function () {
    const otp = TwoFactorCommand.buildOTP({ secret: 'a'.repeat(32) })

    const { res, token } = await login({
      server,
      username: userUsername,
      password: userPassword,
      otpToken: otp.generate(),
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should not login with correct password and incorrect otp code', async function () {
    const { res, token } = await login({
      server,
      username: userUsername,
      password: userPassword,
      otpToken: '123456',
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should not login with incorrect password and correct otp code', async function () {
    const otpToken = TwoFactorCommand.buildOTP({ secret: otpSecret }).generate()

    const { res, token } = await login({
      server,
      username: userUsername,
      password: 'fake',
      otpToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should correctly login with correct password and otp code', async function () {
    const otpToken = TwoFactorCommand.buildOTP({ secret: otpSecret }).generate()

    const { res, token } = await login({ server, username: userUsername, password: userPassword, otpToken })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.exist

    await server.users.getMyInfo({ token })
  })

  it('Should have two factor enabled when getting my info', async function () {
    const { twoFactorEnabled } = await server.users.getMyInfo({ token: userToken })
    expect(twoFactorEnabled).to.be.true
  })

  it('Should disable two factor and be able to login without otp token', async function () {
    await server.twoFactor.disable({ userId, token: userToken, currentPassword: userPassword })

    const { res, token } = await login({ server, username: userUsername, password: userPassword })
    expect(res.header['x-peertube-otp']).to.not.exist

    await server.users.getMyInfo({ token })
  })

  it('Should have two factor disabled when getting my info', async function () {
    const { twoFactorEnabled } = await server.users.getMyInfo({ token: userToken })
    expect(twoFactorEnabled).to.be.false
  })

  it('Should enable two factor auth without password from an admin', async function () {
    const { otpRequest } = await server.twoFactor.request({ userId })

    await server.twoFactor.confirmRequest({
      userId,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate(),
      requestToken: otpRequest.requestToken
    })

    const { twoFactorEnabled } = await server.users.getMyInfo({ token: userToken })
    expect(twoFactorEnabled).to.be.true
  })

  it('Should disable two factor auth without password from an admin', async function () {
    await server.twoFactor.disable({ userId })

    const { twoFactorEnabled } = await server.users.getMyInfo({ token: userToken })
    expect(twoFactorEnabled).to.be.false
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
