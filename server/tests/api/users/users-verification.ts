/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  flushAndRunServer,
  getMyUserInformation,
  getUserInformation,
  login,
  registerUser,
  ServerInfo,
  updateCustomSubConfig,
  updateMyUser,
  userLogin,
  verifyEmail
} from '../../../../shared/extra-utils'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/users/login'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { User } from '../../../../shared/models/users'

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
    this.timeout(5000)
    await updateCustomSubConfig(server.url, server.accessToken, {
      signup: {
        enabled: true,
        requiresEmailVerification: true,
        limit: 10
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
    const resLogin = await login(server.url, server.client, user1, 400)
    expect(resLogin.body.error).to.contain('User email is not verified.')
  })

  it('Should verify the user via email and allow login', async function () {
    await verifyEmail(server.url, userId, verificationString)

    const res = await login(server.url, server.client, user1)
    userAccessToken = res.body.access_token

    const resUserVerified = await getUserInformation(server.url, server.accessToken, userId)
    expect(resUserVerified.body.emailVerified).to.be.true
  })

  it('Should be able to change the user email', async function () {
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
    await updateCustomSubConfig(server.url, server.accessToken, {
      signup: {
        enabled: true,
        requiresEmailVerification: false,
        limit: 10
      }
    })

    await registerUser(server.url, user2.username, user2.password)

    await waitJobs(server)
    expect(emails).to.have.lengthOf(expectedEmailsLength)

    const accessToken = await userLogin(server, user2)

    const resMyUserInfo = await getMyUserInformation(server.url, accessToken)
    expect(resMyUserInfo.body.emailVerified).to.be.null
  })

  it('Should allow login for user with unverified email when setting later enabled', async function () {
    await updateCustomSubConfig(server.url, server.accessToken, {
      signup: {
        enabled: true,
        requiresEmailVerification: true,
        limit: 10
      }
    })

    await userLogin(server, user2)
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
