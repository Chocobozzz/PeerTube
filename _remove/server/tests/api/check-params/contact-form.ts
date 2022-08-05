/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { MockSmtpServer } from '@server/tests/shared'
import { HttpStatusCode } from '@shared/models'
import { cleanupTests, ContactFormCommand, createSingleServer, killallServers, PeerTubeServer } from '@shared/server-commands'

describe('Test contact form API validators', function () {
  let server: PeerTubeServer
  const emails: object[] = []
  const defaultBody = {
    fromName: 'super name',
    fromEmail: 'toto@example.com',
    subject: 'my subject',
    body: 'Hello, how are you?'
  }
  let emailPort: number
  let command: ContactFormCommand

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    emailPort = await MockSmtpServer.Instance.collectEmails(emails)

    // Email is disabled
    server = await createSingleServer(1)
    command = server.contactForm
  })

  it('Should not accept a contact form if emails are disabled', async function () {
    await command.send({ ...defaultBody, expectedStatus: HttpStatusCode.CONFLICT_409 })
  })

  it('Should not accept a contact form if it is disabled in the configuration', async function () {
    this.timeout(25000)

    await killallServers([ server ])

    // Contact form is disabled
    await server.run({ smtp: { hostname: 'localhost', port: emailPort }, contact_form: { enabled: false } })
    await command.send({ ...defaultBody, expectedStatus: HttpStatusCode.CONFLICT_409 })
  })

  it('Should not accept a contact form if from email is invalid', async function () {
    this.timeout(25000)

    await killallServers([ server ])

    // Email & contact form enabled
    await server.run({ smtp: { hostname: 'localhost', port: emailPort } })

    await command.send({ ...defaultBody, fromEmail: 'badEmail', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.send({ ...defaultBody, fromEmail: 'badEmail@', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.send({ ...defaultBody, fromEmail: undefined, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not accept a contact form if from name is invalid', async function () {
    await command.send({ ...defaultBody, fromName: 'name'.repeat(100), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.send({ ...defaultBody, fromName: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.send({ ...defaultBody, fromName: undefined, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not accept a contact form if body is invalid', async function () {
    await command.send({ ...defaultBody, body: 'body'.repeat(5000), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.send({ ...defaultBody, body: 'a', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.send({ ...defaultBody, body: undefined, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should accept a contact form with the correct parameters', async function () {
    await command.send(defaultBody)
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
