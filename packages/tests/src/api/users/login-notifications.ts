/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test login notifications', function () {
  let server: PeerTubeServer
  const emails: object[] = []

  const user = {
    username: 'user_login_notif',
    password: 'super password'
  }

  const userEmail = 'user_login_notif@example.com'
  const firefoxUserAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0'

  // Other users of the platform (root) also receive login notifications, so only consider the ones of our user
  function getUserEmails () {
    return emails.filter(e => e['to'][0]['address'] === userEmail)
  }

  before(async function () {
    this.timeout(30000)

    const port = await MockSmtpServer.Instance.collectEmails(emails, { loginNotifications: true })
    server = await createSingleServer(1, ConfigCommand.getEmailOverrideConfig(port))

    await setAccessTokensToServers([ server ])

    await server.users.create({ username: user.username, password: user.password })
  })

  it('Should send an email on a login from a new device', async function () {
    this.timeout(30000)

    await server.login.login({ user, userAgent: firefoxUserAgent })
    await waitJobs(server)

    const userEmails = getUserEmails()
    expect(userEmails).to.have.lengthOf(1)
    expect(userEmails[0]['subject']).to.contain('new device')
  })

  it('Should not send an email when logging in again from the same device', async function () {
    this.timeout(30000)

    await server.login.login({ user, userAgent: firefoxUserAgent })
    await waitJobs(server)

    expect(getUserEmails()).to.have.lengthOf(1)
  })

  it('Should send an email on a login from another device', async function () {
    this.timeout(30000)

    await server.login.login({ user, userAgent: 'another-device' })
    await waitJobs(server)

    const userEmails = getUserEmails()
    expect(userEmails).to.have.lengthOf(2)
    expect(userEmails[1]['subject']).to.contain('new device')
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
