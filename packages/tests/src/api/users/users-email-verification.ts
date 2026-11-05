/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { HttpStatusCode, UserSignupClient } from '@peertube/peertube-models'
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

    expect(email['text']).to.not.contain('signupClient')

    const userIdMatches = /userId=([0-9]+)/.exec(email['text'])
    expect(userIdMatches).not.to.be.null

    userId = parseInt(userIdMatches[1], 10)

    const body = await server.users.get({ userId })
    expect(body.emailVerified).to.be.false
  })

  it('Should not allow login for user with unverified email', async function () {
    const { code } = await server.login.login({ user: user1, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    expect(code).to.equal('email_not_verified')
  })

  it('Should verify the user via email and allow login', async function () {
    await server.users.verifyEmail({ userId, verificationString })

    const body = await server.login.login({ user: user1 })
    userAccessToken = body.access_token

    const user = await server.users.get({ userId })
    expect(user.emailVerified).to.be.true
  })

  it('Should not verify the email again with the same verification string', async function () {
    await server.users.verifyEmail({ userId, verificationString, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
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

  it('Should not verify a pending email using a verification string minted for the main email', async function () {
    this.timeout(30000)

    let mainEmailVerificationString: string

    {
      await server.users.updateMe({
        token: userAccessToken,
        email: 'attacker-target@example.com',
        currentPassword: user1.password
      })

      await waitJobs(server)
      expectedEmailsLength++
      expect(emails).to.have.lengthOf(expectedEmailsLength)
    }

    {
      await server.users.askSendVerifyEmail({ email: 'updated@example.com' })

      await waitJobs(server)
      expectedEmailsLength++
      expect(emails).to.have.lengthOf(expectedEmailsLength)

      const email = emails[expectedEmailsLength - 1]

      const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
      mainEmailVerificationString = verificationStringMatches[1]
    }

    await server.users.verifyEmail({
      userId,
      verificationString: mainEmailVerificationString,
      isPendingEmail: true,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })

    const me = await server.users.getMyInfo({ token: userAccessToken })
    expect(me.email).to.equal('updated@example.com')
    expect(me.pendingEmail).to.equal('attacker-target@example.com')
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

  describe('Signup client', function () {
    function getLastEmailText () {
      return emails[emails.length - 1]['text'] as string
    }

    it('Should add the signup client in the verification email links of a direct registration', async function () {
      const verifyRegex = /\/verify-account\/email\?userId=\d+&verificationString=[a-z0-9]+&signupClient=peertube-app&username=user_app_1/

      await server.registrations.register({ username: 'user_app_1', signupClient: UserSignupClient.PEERTUBE_APP })
      await waitJobs(server)

      expect(getLastEmailText()).to.match(verifyRegex)

      await server.users.askSendVerifyEmail({ email: 'user_app_1@example.com' })
      await waitJobs(server)

      expect(getLastEmailText()).to.match(verifyRegex)
    })

    it('Should add the signup client in the verification and accepted email links of a registration request', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          signup: {
            requiresApproval: true
          }
        }
      })

      await server.registrations.requestRegistration({
        username: 'user_app_2',
        registrationReason: 'reason',
        signupClient: UserSignupClient.PEERTUBE_APP
      })
      await waitJobs(server)

      const verifyRegex =
        /\/verify-account\/email\?registrationId=(\d+)&verificationString=([a-z0-9]+)&signupClient=peertube-app&username=user_app_2/
      expect(getLastEmailText()).to.match(verifyRegex)

      await server.registrations.askSendVerifyEmail({ email: 'user_app_2@example.com' })
      await waitJobs(server)

      const [ , registrationId, registrationVerificationString ] = verifyRegex.exec(getLastEmailText())

      await server.registrations.verifyEmail({ registrationId: +registrationId, verificationString: registrationVerificationString })
      await server.registrations.accept({ id: +registrationId, moderationResponse: 'welcome' })
      await waitJobs(server)

      expect(getLastEmailText()).to.contain(`${server.url}/login?signupClient=peertube-app&username=user_app_2`)
    })

    it('Should not add the signup client in the accepted email link of a web registration request', async function () {
      await server.registrations.requestRegistration({ username: 'user_web_3', registrationReason: 'reason' })
      await waitJobs(server)

      const [ , registrationId, registrationVerificationString ] = /registrationId=(\d+)&verificationString=([a-z0-9]+)/.exec(
        getLastEmailText()
      )
      expect(getLastEmailText()).to.not.contain('signupClient')

      await server.registrations.verifyEmail({ registrationId: +registrationId, verificationString: registrationVerificationString })
      await server.registrations.accept({ id: +registrationId, moderationResponse: 'welcome' })
      await waitJobs(server)

      expect(getLastEmailText()).to.contain(`${server.url}/login`)
      expect(getLastEmailText()).to.not.contain('signupClient')
    })
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
