import * as request from 'supertest'
import { ContactForm } from '../../models/server'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function sendContactForm (options: {
  url: string
  fromEmail: string
  fromName: string
  subject: string
  body: string
  expectedStatus?: number
}) {
  const path = '/api/v1/server/contact'

  const body: ContactForm = {
    fromEmail: options.fromEmail,
    fromName: options.fromName,
    subject: options.subject,
    body: options.body
  }
  return request(options.url)
    .post(path)
    .send(body)
    .expect(options.expectedStatus || HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

export {
  sendContactForm
}
