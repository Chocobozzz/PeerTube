/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  ContactFormCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test contact form', function () {
  let server: PeerTubeServer
  const emails: object[] = []
  let command: ContactFormCommand

  before(async function () {
    this.timeout(30000)

    const port = await MockSmtpServer.Instance.collectEmails(emails)

    server = await createSingleServer(1, ConfigCommand.getEmailOverrideConfig(port))
    await setAccessTokensToServers([ server ])

    command = server.contactForm
  })

  it('Should send a contact form', async function () {
    await command.send({
      fromEmail: 'toto@example.com',
      body: 'my super message',
      subject: 'my subject',
      fromName: 'Super toto'
    })

    await waitJobs(server)

    expect(emails).to.have.lengthOf(1)

    const email = emails[0]

    expect(email['from'][0]['address']).equal('test-admin@127.0.0.1')
    expect(email['replyTo'][0]['address']).equal('toto@example.com')
    expect(email['to'][0]['address']).equal('admin' + server.internalServerNumber + '@example.com')
    expect(email['subject']).contains('my subject')
    expect(email['text']).contains('my super message')
  })

  it('Should not have duplicated email address in text message', async function () {
    const text = emails[0]['text'] as string

    const matches = text.match(/toto@example.com/g)
    expect(matches).to.have.lengthOf(1)
  })

  it('Should not be able to send another contact form because of the anti spam checker', async function () {
    await wait(1000)

    await command.send({
      fromEmail: 'toto@example.com',
      body: 'my super message',
      subject: 'my subject',
      fromName: 'Super toto'
    })

    await command.send({
      fromEmail: 'toto@example.com',
      body: 'my super message',
      fromName: 'Super toto',
      subject: 'my subject',
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should be able to send another contact form after a while', async function () {
    await wait(1000)

    await command.send({
      fromEmail: 'toto@example.com',
      fromName: 'Super toto',
      subject: 'my subject',
      body: 'my super message'
    })
  })

  it('Should not have the manage preferences link in the email', async function () {
    const email = emails[0]
    expect(email['text']).to.not.contain('Manage your notification preferences')
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
