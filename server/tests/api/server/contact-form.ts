/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushTests, killallServers, runServer, ServerInfo, setAccessTokensToServers, wait } from '../../../../shared/utils'
import { MockSmtpServer } from '../../../../shared/utils/miscs/email'
import { waitJobs } from '../../../../shared/utils/server/jobs'
import { sendContactForm } from '../../../../shared/utils/server/contact-form'

const expect = chai.expect

describe('Test contact form', function () {
  let server: ServerInfo
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

  it('Should send a contact form', async function () {
    this.timeout(10000)

    await sendContactForm({
      url: server.url,
      fromEmail: 'toto@example.com',
      body: 'my super message',
      fromName: 'Super toto'
    })

    await waitJobs(server)

    expect(emails).to.have.lengthOf(1)

    const email = emails[0]

    expect(email['from'][0]['address']).equal('toto@example.com')
    expect(email['to'][0]['address']).equal('admin1@example.com')
    expect(email['subject']).contains('Contact form')
    expect(email['text']).contains('my super message')
  })

  it('Should not be able to send another contact form because of the anti spam checker', async function () {
    await sendContactForm({
      url: server.url,
      fromEmail: 'toto@example.com',
      body: 'my super message',
      fromName: 'Super toto'
    })

    await sendContactForm({
      url: server.url,
      fromEmail: 'toto@example.com',
      body: 'my super message',
      fromName: 'Super toto',
      expectedStatus: 403
    })
  })

  it('Should be able to send another contact form after a while', async function () {
    await wait(1000)

    await sendContactForm({
      url: server.url,
      fromEmail: 'toto@example.com',
      body: 'my super message',
      fromName: 'Super toto'
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()
    killallServers([ server ])
  })
})
