/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import { cleanupTests, flushAndRunServer, immutableAssign, killallServers, reRunServer, ServerInfo } from '../../../../shared/extra-utils'
import { sendContactForm } from '../../../../shared/extra-utils/server/contact-form'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'

describe('Test contact form API validators', function () {
  let server: ServerInfo
  const emails: object[] = []
  const defaultBody = {
    fromName: 'super name',
    fromEmail: 'toto@example.com',
    subject: 'my subject',
    body: 'Hello, how are you?'
  }
  let emailPort: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    emailPort = await MockSmtpServer.Instance.collectEmails(emails)

    // Email is disabled
    server = await flushAndRunServer(1)
  })

  it('Should not accept a contact form if emails are disabled', async function () {
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 409 }))
  })

  it('Should not accept a contact form if it is disabled in the configuration', async function () {
    this.timeout(10000)

    killallServers([ server ])

    // Contact form is disabled
    await reRunServer(server, { smtp: { hostname: 'localhost', port: emailPort }, contact_form: { enabled: false } })
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 409 }))
  })

  it('Should not accept a contact form if from email is invalid', async function () {
    this.timeout(10000)

    killallServers([ server ])

    // Email & contact form enabled
    await reRunServer(server, { smtp: { hostname: 'localhost', port: emailPort } })

    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, fromEmail: 'badEmail' }))
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, fromEmail: 'badEmail@' }))
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, fromEmail: undefined }))
  })

  it('Should not accept a contact form if from name is invalid', async function () {
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, fromName: 'name'.repeat(100) }))
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, fromName: '' }))
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, fromName: undefined }))
  })

  it('Should not accept a contact form if body is invalid', async function () {
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, body: 'body'.repeat(5000) }))
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, body: 'a' }))
    await sendContactForm(immutableAssign(defaultBody, { url: server.url, expectedStatus: 400, body: undefined }))
  })

  it('Should accept a contact form with the correct parameters', async function () {
    await sendContactForm(immutableAssign(defaultBody, { url: server.url }))
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
