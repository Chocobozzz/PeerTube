/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoCreateResult } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { config, expect } from 'chai'

config.truncateThreshold = 0

describe('Test emails', function () {
  let server: PeerTubeServer
  let userId: number
  let userId2: number
  let userAccessToken: string

  let videoShortUUID: string
  let videoId: number

  let videoUserUUID: string

  let verificationString: string
  let verificationString2: string

  const emails: object[] = []
  const user = {
    username: 'user_1',
    password: 'super_password'
  }

  const similarUsers = [ { username: 'lowercase_user_1' }, { username: 'lowercase_user__1' } ]

  before(async function () {
    this.timeout(120000)

    const emailPort = await MockSmtpServer.Instance.collectEmails(emails)
    server = await createSingleServer(1, {
      ...ConfigCommand.getEmailOverrideConfig(emailPort),

      // Reset password links are asked many times
      rates_limit: { ask_send_email: { max: 50 } }
    })

    await setAccessTokensToServers([ server ])
    await server.config.enableSignup(true)

    {
      const sqlCommand = new SQLCommand(server)

      for (const user of similarUsers) {
        await server.users.create(user)
      }

      await sqlCommand.setUserEmail('lowercase_user__1', 'Lowercase_user_1@example.com')
      await sqlCommand.cleanup()
    }

    {
      const created = await server.users.create({ username: user.username, password: user.password })
      userId = created.id

      userAccessToken = await server.login.getAccessToken(user)
    }

    {
      const attributes = { name: 'my super user video' }
      const { uuid } = await server.videos.upload({ token: userAccessToken, attributes })
      videoUserUUID = uuid
    }

    {
      const attributes = {
        name: 'my super name'
      }
      const { shortUUID, id } = await server.videos.upload({ attributes })
      videoShortUUID = shortUUID
      videoId = id
    }
  })

  describe('When resetting user password', function () {
    it('Should ask to reset the password', async function () {
      await server.users.askResetPassword({ email: 'user_1@example.com' })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(1)

      const email = emails[0]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains('password')

      const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
      expect(verificationStringMatches).not.to.be.null

      verificationString = verificationStringMatches[1]
      expect(verificationString).to.have.length.above(2)

      const userIdMatches = /userId=([0-9]+)/.exec(email['text'])
      expect(userIdMatches).not.to.be.null

      userId = parseInt(userIdMatches[1], 10)
      expect(verificationString).to.not.be.undefined
    })

    it('Should not reset the password with an invalid verification string', async function () {
      await server.users.resetPassword({
        userId,
        verificationString: verificationString + 'b',
        password: 'super_password2',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with wrong capitalization when multiple users with similar email exists', async function () {
      await server.users.askResetPassword({ email: similarUsers[0].username.toUpperCase(), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should reset the password', async function () {
      await server.users.resetPassword({ userId, verificationString, password: 'super_password2' })
      user.password = 'super_password2'
    })

    it('Should have invalided user tokens', async function () {
      await server.users.getMyQuotaUsed({ token: userAccessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

      userAccessToken = await server.login.getAccessToken(user)
    })

    it('Should not reset the password with the same verification string', async function () {
      await server.users.resetPassword({
        userId,
        verificationString,
        password: 'super_password3',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should login with this new password', async function () {
      user.password = 'super_password2'

      await server.login.getAccessToken(user)
    })
  })

  describe('When creating a user without password', function () {
    it('Should send a create password email', async function () {
      await server.users.create({ username: 'create_password', password: '' })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(2)

      const email = emails[1]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('create_password@example.com')
      expect(email['subject']).contains('account')
      expect(email['subject']).contains('password')

      const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
      expect(verificationStringMatches).not.to.be.null

      verificationString2 = verificationStringMatches[1]
      expect(verificationString2).to.have.length.above(2)

      const userIdMatches = /userId=([0-9]+)/.exec(email['text'])
      expect(userIdMatches).not.to.be.null

      userId2 = parseInt(userIdMatches[1], 10)
    })

    it('Should not reset the password with an invalid verification string', async function () {
      await server.users.resetPassword({
        userId: userId2,
        verificationString: verificationString2 + 'c',
        password: 'newly_created_password',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should reset the password', async function () {
      await server.users.resetPassword({
        userId: userId2,
        verificationString: verificationString2,
        password: 'newly_created_password'
      })
    })

    it('Should login with this new password', async function () {
      await server.login.getAccessToken({
        username: 'create_password',
        password: 'newly_created_password'
      })
    })
  })

  describe('When creating an abuse', function () {
    it('Should send the notification email', async function () {
      const reason = 'my super bad reason'
      await server.abuses.report({ token: userAccessToken, videoId, reason })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(3)

      const email = emails[2]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('admin' + server.internalServerNumber + '@example.com')
      expect(email['subject']).contains('abuse')
      expect(email['text']).contains(videoShortUUID)
    })
  })

  describe('When blocking/unblocking user', function () {
    it('Should send the notification email when blocking a user', async function () {
      const reason = 'my super bad reason'
      await server.users.banUser({ userId, reason })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(4)

      const email = emails[3]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' blocked')
      expect(email['text']).contains(' blocked')
      expect(email['text']).contains('bad reason')
    })

    it('Should send the notification email when unblocking a user', async function () {
      await server.users.unbanUser({ userId })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(5)

      const email = emails[4]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' unblocked')
      expect(email['text']).contains(' unblocked')
    })
  })

  describe('When blacklisting a video', function () {
    it('Should send the notification email', async function () {
      const reason = 'my super reason'
      await server.blacklist.add({ videoId: videoUserUUID, reason })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(6)

      const email = emails[5]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' blocked')
      expect(email['text']).contains('my super user video')
      expect(email['text']).contains('my super reason')
    })

    it('Should send the notification email', async function () {
      await server.blacklist.remove({ videoId: videoUserUUID })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(7)

      const email = emails[6]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' unblocked')
      expect(email['text']).contains('my super user video')
    })

    it('Should have the manage preferences link in the email', async function () {
      const email = emails[6]
      expect(email['text']).to.contain('Manage your notification preferences')
    })
  })

  describe('When verifying a user email', function () {
    it('Should fail with wrong capitalization when multiple users with similar email exists', async function () {
      await server.users.askSendVerifyEmail({
        email: similarUsers[0].username.toUpperCase(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should ask to send the verification email', async function () {
      await server.users.askSendVerifyEmail({ email: 'user_1@example.com' })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(8)

      const email = emails[7]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains('Verify')

      const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
      expect(verificationStringMatches).not.to.be.null

      verificationString = verificationStringMatches[1]
      expect(verificationString).to.not.be.undefined
      expect(verificationString).to.have.length.above(2)

      const userIdMatches = /userId=([0-9]+)/.exec(email['text'])
      expect(userIdMatches).not.to.be.null

      userId = parseInt(userIdMatches[1], 10)
    })

    it('Should not verify the email with an invalid verification string', async function () {
      await server.users.verifyEmail({
        userId,
        verificationString: verificationString + 'b',
        isPendingEmail: false,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should verify the email', async function () {
      await server.users.verifyEmail({ userId, verificationString })
    })

    it('Should not verify the email again with the same verification string', async function () {
      await server.users.verifyEmail({
        userId,
        verificationString,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When verifying a registration email', function () {
    let registrationId: number
    let registrationIdEmail: number

    before(async function () {
      await server.registrations.requestRegistration({
        username: 'request_1',
        email: 'request_1@example.com',
        registrationReason: 'tt'
      })
      const registrations = await server.registrations.list()
      registrationId = registrations.data[0].id
    })

    it('Should ask to send the verification email', async function () {
      await server.registrations.askSendVerifyEmail({ email: 'request_1@example.com' })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(9)

      const email = emails[8]

      expect(email['from'][0]['name']).equal('PeerTube')
      expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
      expect(email['to'][0]['address']).equal('request_1@example.com')
      expect(email['subject']).contains('Verify')

      const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text'])
      expect(verificationStringMatches).not.to.be.null

      verificationString = verificationStringMatches[1]
      expect(verificationString).to.not.be.undefined
      expect(verificationString).to.have.length.above(2)

      const registrationIdMatches = /registrationId=([0-9]+)/.exec(email['text'])
      expect(registrationIdMatches).not.to.be.null

      registrationIdEmail = parseInt(registrationIdMatches[1], 10)

      expect(registrationId).to.equal(registrationIdEmail)
    })

    it('Should not verify the email with an invalid verification string', async function () {
      await server.registrations.verifyEmail({
        registrationId: registrationIdEmail,
        verificationString: verificationString + 'b',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should verify the email', async function () {
      await server.registrations.verifyEmail({ registrationId: registrationIdEmail, verificationString })
    })

    it('Should not verify the email again with the same verification string', async function () {
      await server.registrations.verifyEmail({
        registrationId: registrationIdEmail,
        verificationString,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When the email or the password of a user changes', function () {
    const resetUser = {
      username: 'reset_link_user',
      password: 'reset_link_password'
    }
    let resetUserId: number
    let resetUserToken: string
    let resetUserEmail = 'reset_link_user@example.com'

    async function getLastVerificationString (to: string) {
      await waitJobs(server)

      const email = emails[emails.length - 1]
      expect(email['to'][0]['address']).to.equal(to)

      return /verificationString=([a-z0-9]+)/.exec(email['text'])[1]
    }

    async function askResetPassword () {
      await server.users.askResetPassword({ email: resetUserEmail })

      return getLastVerificationString(resetUserEmail)
    }

    async function expectRevoked (verificationString: string, userId = resetUserId) {
      await server.users.resetPassword({
        userId,
        verificationString,
        password: 'should_not_be_set',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    }

    before(async function () {
      const created = await server.users.create({ ...resetUser })
      resetUserId = created.id

      resetUserToken = await server.login.getAccessToken(resetUser)
    })

    it('Should revoke the reset password link when the user changes their email', async function () {
      const verificationString = await askResetPassword()

      resetUserEmail = 'reset_link_user_2@example.com'
      await server.users.updateMe({ token: resetUserToken, email: resetUserEmail, currentPassword: resetUser.password })

      await expectRevoked(verificationString)
    })

    it('Should revoke the reset password link when the user changes their password', async function () {
      const verificationString = await askResetPassword()

      await server.users.updateMe({ token: resetUserToken, password: 'reset_link_password_2', currentPassword: resetUser.password })
      resetUser.password = 'reset_link_password_2'

      await expectRevoked(verificationString)
    })

    it('Should keep the reset password link when the user updates other fields', async function () {
      const verificationString = await askResetPassword()

      await server.users.updateMe({ token: resetUserToken, displayName: 'reset link user' })
      await server.users.updateMe({ token: resetUserToken, email: resetUserEmail, currentPassword: resetUser.password })

      await server.users.resetPassword({ userId: resetUserId, verificationString, password: 'reset_link_password_3' })
      resetUser.password = 'reset_link_password_3'
    })

    it('Should revoke the reset password link when an admin changes the user email', async function () {
      const verificationString = await askResetPassword()

      resetUserEmail = 'reset_link_user_3@example.com'
      await server.users.update({ userId: resetUserId, email: resetUserEmail })

      await expectRevoked(verificationString)
    })

    it('Should revoke the reset password link when an admin changes the user password', async function () {
      const verificationString = await askResetPassword()

      resetUser.password = 'reset_link_password_4'
      await server.users.update({ userId: resetUserId, password: resetUser.password })

      await expectRevoked(verificationString)

      await server.login.getAccessToken(resetUser)
    })

    it('Should revoke the create password link when an admin changes the user email', async function () {
      const { id } = await server.users.create({ username: 'create_password_revoked', password: '' })
      const verificationString = await getLastVerificationString('create_password_revoked@example.com')

      await server.users.update({ userId: id, email: 'create_password_revoked_2@example.com' })

      await expectRevoked(verificationString, id)
    })
  })

  describe('Email config', function () {
    it('Should configure email subject prefix and body signature', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          instance: {
            name: 'My tube'
          },
          email: {
            subject: {
              prefix: 'My custom prefix {{instanceName}}'
            },
            body: {
              signature: 'My custom signature {{instanceName}}'
            }
          }
        }
      })

      await server.users.banUser({ userId })
      await waitJobs(server)

      const email = emails[emails.length - 1]

      expectStartWith(email['subject'], 'My custom prefix My tube')
      expect(email['text']).to.contain('My custom signature My tube')
    })
  })

  describe('Email translations', function () {
    let video: VideoCreateResult

    before(async function () {
      video = await server.videos.quickUpload({ name: 'video' })

      await server.config.updateExistingConfig({
        newConfig: {
          instance: {
            defaultLanguage: 'fr'
          }
        }
      })
    })

    it('Should translate emails according to the instance language', async function () {
      await server.contactForm.send({
        fromEmail: 'toto@example.com',
        body: 'my super message',
        subject: 'my subject',
        fromName: 'Super toto'
      })

      await waitJobs(server)

      const email = emails[emails.length - 1]

      expect(email['subject']).to.contain('Formulaire de contact')
      expect(email['text']).to.contain('Super toto vous a envoyé un message')
    })

    it('Should translate emails according to the instance language if not provided by the user', async function () {
      await server.blacklist.add({ videoId: video.uuid })
      await waitJobs(server)

      const email = emails[emails.length - 1]
      expect(email['subject']).to.contain('été bloquée')
      expect(email['text']).to.contain('été bloquée')
    })

    it('Should translate emails according to the user language if provided', async function () {
      await server.users.updateMe({ language: 'en' })

      await server.blacklist.remove({ videoId: video.uuid })
      await waitJobs(server)

      const email = emails[emails.length - 1]
      expect(email['subject']).to.contain('has been unblocked')
      expect(email['text']).to.contain('has been unblocked')
    })

    it('Should update user language and translate emails accordingly', async function () {
      await server.users.updateMe({ language: 'fr' })

      await server.blacklist.add({ videoId: video.uuid })
      await waitJobs(server)

      const email = emails[emails.length - 1]
      expect(email['subject']).to.contain('été bloquée')
      expect(email['text']).to.contain('été bloquée')
    })
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
