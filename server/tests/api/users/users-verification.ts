/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import {
  cleanupTests,
  flushAndRunServer,
  getMyUserInformation,
  getUserInformation,
  MockSmtpServer,
  registerUser,
  ServerInfo,
  setAccessTokensToServers,
  updateMyUser,
  verifyEmail,
  waitJobs
} from '@shared/extra-utils'
import { User } from '@shared/models'

const expect = chai.expect

describe('Test users account verification', function () {
  let server: ServerInfo
  let userId: number
  let userAccessToken: string
  let verificationString: string
  let expectedEmailsLength = 0
  const user1 = {
    username: 'user_1',
    password: 'super password'
  }
  const user2 = {
    username: 'user_2',
    password: 'super password'
  }
  const emails: object[] = []

  before(async function () {
    this.timeout(30000)

    const port = await MockSmtpServer.Instance.collectEmails(emails)

    const overrideConfig = {
      smtp: {
        hostname: 'localhost',
        port
      }
    }
    server = await flushAndRunServer(1, overrideConfig)

    await setAccessTokensToServers([ server ])
  })

  it('Should register user and send verification email if verification required', async function () {
    this.timeout(30000)

    await server.configCommand.updateCustomSubConfig({
      newConfig: {
        signup: {
          enabled: true,
          requiresEmailVerification: true,
          limit: 10
        }
      }
    })

    await registerUser(server.url, user1.username, user1.password)

    await waitJobs(server)
    expectedEmailsLength++
    expect(emails).to.have.lengthOf(expectedEmailsLength)

    const email = emails[expectedEmailsLength - 1]

    const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
    expect(verificationStringMatches).not.to.be.null

    verificationString = verificationStringMatches[1]
    expect(verificationString).to.have.length.above(2)

    const userIdMatches = /userId=([0-9]+)/.exec(email['text'])
    expect(userIdMatches).not.to.be.null

    userId = parseInt(userIdMatches[1], 10)

    const resUserInfo = await getUserInformation(server.url, server.accessToken, userId)
    expect(resUserInfo.body.emailVerified).to.be.false
  })

  it('Should not allow login for user with unverified email', async function () {
    const { detail } = await server.loginCommand.login({ user: user1, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    expect(detail).to.contain('User email is not verified.')
  })

  it('Should verify the user via email and allow login', async function () {
    await verifyEmail(server.url, userId, verificationString)

    const body = await server.loginCommand.login({ user: user1 })
    userAccessToken = body.access_token

    const resUserVerified = await getUserInformation(server.url, server.accessToken, userId)
    expect(resUserVerified.body.emailVerified).to.be.true
  })

  it('Should be able to change the user email', async function () {
    this.timeout(10000)

    let updateVerificationString: string

    {
      await updateMyUser({
        url: server.url,
        accessToken: userAccessToken,
        email: 'updated@example.com',
        currentPassword: user1.password
      })

      await waitJobs(server)
      expectedEmailsLength++
      expect(emails).to.have.lengthOf(expectedEmailsLength)

      const email = emails[expectedEmailsLength - 1]

      const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
      updateVerificationString = verificationStringMatches[1]
    }

    {
      const res = await getMyUserInformation(server.url, userAccessToken)
      const me: User = res.body

      expect(me.email).to.equal('user_1@example.com')
      expect(me.pendingEmail).to.equal('updated@example.com')
    }

    {
      await verifyEmail(server.url, userId, updateVerificationString, true)

      const res = await getMyUserInformation(server.url, userAccessToken)
      const me: User = res.body

      expect(me.email).to.equal('updated@example.com')
      expect(me.pendingEmail).to.be.null
    }
  })

  it('Should register user not requiring email verification if setting not enabled', async function () {
    this.timeout(5000)
    await server.configCommand.updateCustomSubConfig({
      newConfig: {
        signup: {
          enabled: true,
          requiresEmailVerification: false,
          limit: 10
        }
      }
    })

    await registerUser(server.url, user2.username, user2.password)

    await waitJobs(server)
    expect(emails).to.have.lengthOf(expectedEmailsLength)

    const accessToken = await server.loginCommand.getAccessToken(user2)

    const resMyUserInfo = await getMyUserInformation(server.url, accessToken)
    expect(resMyUserInfo.body.emailVerified).to.be.null
  })

  it('Should allow login for user with unverified email when setting later enabled', async function () {
    await server.configCommand.updateCustomSubConfig({
      newConfig: {
        signup: {
          enabled: true,
          requiresEmailVerification: true,
          limit: 10
        }
      }
    })

    await server.loginCommand.getAccessToken(user2)
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
