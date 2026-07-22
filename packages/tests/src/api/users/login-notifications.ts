/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { getAllNotificationsSettings } from '@tests/shared/notifications/notifications-common.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test login notifications', function () {
  let server: PeerTubeServer
  const emails: object[] = []
  let expectedEmailsLength = 0

  const user = {
    username: 'user_login_notif',
    password: 'super password'
  }

  before(async function () {
    this.timeout(30000)

    const port = await MockSmtpServer.Instance.collectEmails(emails)
    server = await createSingleServer(1, ConfigCommand.getEmailOverrideConfig(port))

    await setAccessTokensToServers([ server ])

    await server.users.create({ username: user.username, password: user.password })
  })

  it('Should not send an email on successful login by default', async function () {
    await server.login.login({ user })

    await waitJobs(server)
    expect(emails).to.have.lengthOf(expectedEmailsLength)
  })

  it('Should send an email on successful login when the user enables it', async function () {
    this.timeout(30000)

    const token = await server.login.getAccessToken(user)

    await makePutBodyRequest({
      url: server.url,
      path: '/api/v1/users/me/notification-settings',
      token,
      fields: getAllNotificationsSettings(),
      expectedStatus: HttpStatusCode.NO_CONTENT_204
    })

    await waitJobs(server)
    expectedEmailsLength = emails.length

    await server.login.login({ user, userAgent: 'another-device' })

    await waitJobs(server)
    expectedEmailsLength++
    expect(emails).to.have.lengthOf(expectedEmailsLength)

    const email = emails[expectedEmailsLength - 1]
    expect(email['subject']).to.contain('new device')
  })

  it('Should not mention a new device when logging in again from the same device', async function () {
    await server.login.login({ user, userAgent: 'another-device' })

    await waitJobs(server)
    expectedEmailsLength++
    expect(emails).to.have.lengthOf(expectedEmailsLength)

    const email = emails[expectedEmailsLength - 1]
    expect(email['subject']).to.not.contain('new device')
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
