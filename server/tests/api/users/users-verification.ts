/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  registerUser, flushTests, getUserInformation, getMyUserInformation, killallServers,
  userLogin, login, runServer, ServerInfo, verifyEmail, updateCustomSubConfig, wait
} from '../../../../shared/utils'
import { setAccessTokensToServers } from '../../../../shared/utils/users/login'
import { MockSmtpServer } from '../../../../shared/utils/miscs/email'
import { waitJobs } from '../../../../shared/utils/server/jobs'

const expect = chai.expect

describe('Test users account verification', function () {
  let server: ServerInfo
  let userId: number
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

    await MockSmtpServer.Instance.collectEmails(emails)

    await flushTests()

    const overrideConfig = {
      smtp: {
        hostname: 'localhost'
      }
    }
    server = await runServer(1, overrideConfig)

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
    await login(server.url, server.client, user1)
    const resUserVerified = await getUserInformation(server.url, server.accessToken, userId)
    expect(resUserVerified.body.emailVerified).to.be.true
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
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this[ 'ok' ]) {
      await flushTests()
    }
  })
})
