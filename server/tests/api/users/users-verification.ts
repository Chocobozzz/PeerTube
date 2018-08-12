/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  registerUser, flushTests, getUserInformation, killallServers, login,
  runServer, ServerInfo, verifyEmail, updateCustomSubConfig
} from '../../utils'
import { setAccessTokensToServers } from '../../utils/users/login'
import { mockSmtpServer } from '../../utils/miscs/email'
import { waitJobs } from '../../utils/server/jobs'

const expect = chai.expect

describe('Test users account verification', function () {
  let server: ServerInfo
  let userId: number
  let verificationString: string
  const user = {
    username: 'user_1',
    password: 'super password'
  }
  const emails: object[] = []

  before(async function () {
    this.timeout(30000)

    await mockSmtpServer(emails)

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
        requiresVerification: true,
        limit: 10
      }
    })

    await registerUser(server.url, user.username, user.password)

    await waitJobs(server)
    expect(emails).to.have.lengthOf(1)

    const email = emails[0]

    const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
    expect(verificationStringMatches).not.to.be.null

    verificationString = verificationStringMatches[1]
    expect(verificationString).to.have.length.above(2)

    const userIdMatches = /userId=([0-9]+)/.exec(email['text'])
    expect(userIdMatches).not.to.be.null

    userId = parseInt(userIdMatches[1], 10)

    const resUserInfo = await getUserInformation(server.url, server.accessToken, userId)
    expect(resUserInfo.body.verified).to.be.false
  })

  it('Should not allow login for unverified user', async function () {
    const resLogin = await login(server.url, server.client, user, 400)
    expect(resLogin.body.error).to.contain('User is not verified.')
  })

  it('Should verify the user via email and allow login', async function () {
    await verifyEmail(server.url, userId, verificationString)
    await login(server.url, server.client, user)
    const resUserVerified = await getUserInformation(server.url, server.accessToken, userId)
    expect(resUserVerified.body.verified).to.be.true
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this[ 'ok' ]) {
      await flushTests()
    }
  })
})
