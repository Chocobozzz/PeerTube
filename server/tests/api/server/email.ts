/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  addVideoToBlacklist,
  askResetPassword,
  askSendVerifyEmail,
  blockUser,
  cleanupTests,
  createUser,
  flushAndRunServer,
  removeVideoFromBlacklist,
  reportAbuse,
  resetPassword,
  ServerInfo,
  setAccessTokensToServers,
  unblockUser,
  uploadVideo,
  userLogin,
  verifyEmail
} from '../../../../shared/extra-utils'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'

const expect = chai.expect

describe('Test emails', function () {
  let server: ServerInfo
  let userId: number
  let userId2: number
  let userAccessToken: string

  let videoUUID: string
  let videoId: number

  let videoUserUUID: string

  let verificationString: string
  let verificationString2: string

  const emails: object[] = []
  const user = {
    username: 'user_1',
    password: 'super_password'
  }
  let emailPort: number

  before(async function () {
    this.timeout(50000)

    emailPort = await MockSmtpServer.Instance.collectEmails(emails)

    const overrideConfig = {
      smtp: {
        hostname: 'localhost',
        port: emailPort
      }
    }
    server = await flushAndRunServer(1, overrideConfig)
    await setAccessTokensToServers([ server ])

    {
      const res = await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
      userId = res.body.user.id

      userAccessToken = await userLogin(server, user)
    }

    {
      const attributes = {
        name: 'my super user video'
      }
      const res = await uploadVideo(server.url, userAccessToken, attributes)
      videoUserUUID = res.body.video.uuid
    }

    {
      const attributes = {
        name: 'my super name'
      }
      const res = await uploadVideo(server.url, server.accessToken, attributes)
      videoUUID = res.body.video.uuid
      videoId = res.body.video.id
    }
  })

  describe('When resetting user password', function () {

    it('Should ask to reset the password', async function () {
      this.timeout(10000)

      await askResetPassword(server.url, 'user_1@example.com')

      await waitJobs(server)
      expect(emails).to.have.lengthOf(1)

      const email = emails[0]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
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
      await resetPassword(server.url, userId, verificationString + 'b', 'super_password2', 403)
    })

    it('Should reset the password', async function () {
      await resetPassword(server.url, userId, verificationString, 'super_password2')
    })

    it('Should login with this new password', async function () {
      user.password = 'super_password2'

      await userLogin(server, user)
    })
  })

  describe('When creating a user without password', function () {
    it('Should send a create password email', async function () {
      this.timeout(10000)

      await createUser({
        url: server.url,
        accessToken: server.accessToken,
        username: 'create_password',
        password: ''
      })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(2)

      const email = emails[1]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
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
      await resetPassword(server.url, userId2, verificationString2 + 'c', 'newly_created_password', 403)
    })

    it('Should reset the password', async function () {
      await resetPassword(server.url, userId2, verificationString2, 'newly_created_password')
    })

    it('Should login with this new password', async function () {
      await userLogin(server, {
        username: 'create_password',
        password: 'newly_created_password'
      })
    })
  })

  describe('When creating an abuse', function () {
    it('Should send the notification email', async function () {
      this.timeout(10000)

      const reason = 'my super bad reason'
      await reportAbuse({ url: server.url, token: server.accessToken, videoId, reason })

      await waitJobs(server)
      expect(emails).to.have.lengthOf(3)

      const email = emails[2]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
      expect(email['to'][0]['address']).equal('admin' + server.internalServerNumber + '@example.com')
      expect(email['subject']).contains('abuse')
      expect(email['text']).contains(videoUUID)
    })
  })

  describe('When blocking/unblocking user', function () {

    it('Should send the notification email when blocking a user', async function () {
      this.timeout(10000)

      const reason = 'my super bad reason'
      await blockUser(server.url, userId, server.accessToken, 204, reason)

      await waitJobs(server)
      expect(emails).to.have.lengthOf(4)

      const email = emails[3]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' blocked')
      expect(email['text']).contains(' blocked')
      expect(email['text']).contains(reason)
    })

    it('Should send the notification email when unblocking a user', async function () {
      this.timeout(10000)

      await unblockUser(server.url, userId, server.accessToken, 204)

      await waitJobs(server)
      expect(emails).to.have.lengthOf(5)

      const email = emails[4]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' unblocked')
      expect(email['text']).contains(' unblocked')
    })
  })

  describe('When blacklisting a video', function () {
    it('Should send the notification email', async function () {
      this.timeout(10000)

      const reason = 'my super reason'
      await addVideoToBlacklist(server.url, server.accessToken, videoUserUUID, reason)

      await waitJobs(server)
      expect(emails).to.have.lengthOf(6)

      const email = emails[5]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' blacklisted')
      expect(email['text']).contains('my super user video')
      expect(email['text']).contains('my super reason')
    })

    it('Should send the notification email', async function () {
      this.timeout(10000)

      await removeVideoFromBlacklist(server.url, server.accessToken, videoUserUUID)

      await waitJobs(server)
      expect(emails).to.have.lengthOf(7)

      const email = emails[6]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
      expect(email['to'][0]['address']).equal('user_1@example.com')
      expect(email['subject']).contains(' unblacklisted')
      expect(email['text']).contains('my super user video')
    })
  })

  describe('When verifying a user email', function () {

    it('Should ask to send the verification email', async function () {
      this.timeout(10000)

      await askSendVerifyEmail(server.url, 'user_1@example.com')

      await waitJobs(server)
      expect(emails).to.have.lengthOf(8)

      const email = emails[7]

      expect(email['from'][0]['name']).equal('localhost:' + server.port)
      expect(email['from'][0]['address']).equal('test-admin@localhost')
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
      await verifyEmail(server.url, userId, verificationString + 'b', false, 403)
    })

    it('Should verify the email', async function () {
      await verifyEmail(server.url, userId, verificationString)
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
