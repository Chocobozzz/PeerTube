/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith } from '@server/tests/shared'
import { HttpStatusCode } from '@shared/models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers, TwoFactorCommand } from '@shared/server-commands'

async function login (options: {
  server: PeerTubeServer
  password?: string
  otpToken?: string
  expectedStatus?: HttpStatusCode
}) {
  const { server, password = server.store.user.password, otpToken, expectedStatus } = options

  const user = { username: server.store.user.username, password }
  const { res, body: { access_token: token } } = await server.login.loginAndGetResponse({ user, otpToken, expectedStatus })

  return { res, token }
}

describe('Test users', function () {
  let server: PeerTubeServer
  let rootId: number
  let otpSecret: string
  let requestToken: string

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const { id } = await server.users.getMyInfo()
    rootId = id
  })

  it('Should not add the header on login if two factor is not enabled', async function () {
    const { res, token } = await login({ server })

    expect(res.header['x-peertube-otp']).to.not.exist

    await server.users.getMyInfo({ token })
  })

  it('Should request two factor and get the secret and uri', async function () {
    const { otpRequest } = await server.twoFactor.request({
      userId: rootId,
      currentPassword: server.store.user.password
    })

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
    const { twoFactorEnabled } = await server.users.getMyInfo()
    expect(twoFactorEnabled).to.be.false
  })

  it('Should confirm two factor', async function () {
    await server.twoFactor.confirmRequest({
      userId: rootId,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpSecret }).generate(),
      requestToken
    })
  })

  it('Should not add the header on login if two factor is enabled and password is incorrect', async function () {
    const { res, token } = await login({ server, password: 'fake', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should add the header on login if two factor is enabled and password is correct', async function () {
    const { res, token } = await login({ server, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

    expect(res.header['x-peertube-otp']).to.exist
    expect(token).to.not.exist

    await server.users.getMyInfo({ token })
  })

  it('Should not login with correct password and incorrect otp secret', async function () {
    const otp = TwoFactorCommand.buildOTP({ secret: 'a'.repeat(32) })

    const { res, token } = await login({ server, otpToken: otp.generate(), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should not login with correct password and incorrect otp code', async function () {
    const { res, token } = await login({ server, otpToken: '123456', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should not login with incorrect password and correct otp code', async function () {
    const otpToken = TwoFactorCommand.buildOTP({ secret: otpSecret }).generate()

    const { res, token } = await login({ server, password: 'fake', otpToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.not.exist
  })

  it('Should correctly login with correct password and otp code', async function () {
    const otpToken = TwoFactorCommand.buildOTP({ secret: otpSecret }).generate()

    const { res, token } = await login({ server, otpToken })

    expect(res.header['x-peertube-otp']).to.not.exist
    expect(token).to.exist

    await server.users.getMyInfo({ token })
  })

  it('Should have two factor enabled when getting my info', async function () {
    const { twoFactorEnabled } = await server.users.getMyInfo()
    expect(twoFactorEnabled).to.be.true
  })

  it('Should disable two factor and be able to login without otp token', async function () {
    await server.twoFactor.disable({ userId: rootId, currentPassword: server.store.user.password })

    const { res, token } = await login({ server })
    expect(res.header['x-peertube-otp']).to.not.exist

    await server.users.getMyInfo({ token })
  })

  it('Should have two factor disabled when getting my info', async function () {
    const { twoFactorEnabled } = await server.users.getMyInfo()
    expect(twoFactorEnabled).to.be.false
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
