/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test users email verification', function () {
  let server: PeerTubeServer
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
    server = await createSingleServer(1, ConfigCommand.getEmailOverrideConfig(port))

    await setAccessTokensToServers([ server ])
  })

  it('Should register user and send verification email if verification required', async function () {
    this.timeout(30000)

    await server.config.updateExistingConfig({
      newConfig: {
        signup: {
          enabled: true,
          requiresApproval: false,
          requiresEmailVerification: true,
          limit: 10
        }
      }
    })

    await server.registrations.register(user1)

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

    const body = await server.users.get({ userId })
    expect(body.emailVerified).to.be.false
  })

  it('Should not allow login for user with unverified email', async function () {
    const { detail } = await server.login.login({ user: user1, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    expect(detail).to.contain('User email is not verified.')
  })

  it('Should verify the user via email and allow login', async function () {
    await server.users.verifyEmail({ userId, verificationString })

    const body = await server.login.login({ user: user1 })
    userAccessToken = body.access_token

    const user = await server.users.get({ userId })
    expect(user.emailVerified).to.be.true
  })

  it('Should be able to change the user email', async function () {
    let updateVerificationString: string

    {
      await server.users.updateMe({
        token: userAccessToken,
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
      const me = await server.users.getMyInfo({ token: userAccessToken })
      expect(me.email).to.equal('user_1@example.com')
      expect(me.pendingEmail).to.equal('updated@example.com')
    }

    {
      await server.users.verifyEmail({ userId, verificationString: updateVerificationString, isPendingEmail: true })

      const me = await server.users.getMyInfo({ token: userAccessToken })
      expect(me.email).to.equal('updated@example.com')
      expect(me.pendingEmail).to.be.null
    }
  })

  it('Should register user not requiring email verification if setting not enabled', async function () {
    this.timeout(5000)
    await server.config.updateExistingConfig({
      newConfig: {
        signup: {
          requiresEmailVerification: false
        }
      }
    })

    await server.registrations.register(user2)

    await waitJobs(server)
    expect(emails).to.have.lengthOf(expectedEmailsLength)

    const accessToken = await server.login.getAccessToken(user2)

    const user = await server.users.getMyInfo({ token: accessToken })
    expect(user.emailVerified).to.be.null
  })

  it('Should allow login for user with unverified email when setting later enabled', async function () {
    await server.config.updateExistingConfig({
      newConfig: {
        signup: {
          requiresEmailVerification: true
        }
      }
    })

    await server.login.getAccessToken(user2)
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
