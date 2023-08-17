import { ContactForm, HttpStatusCode } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ContactFormCommand extends AbstractCommand {

  send (options: OverrideCommandOptions & {
    fromEmail: string
    fromName: string
    subject: string
    body: string
  }) {
    const path = '/api/v1/server/contact'

    const body: ContactForm = {
      fromEmail: options.fromEmail,
      fromName: options.fromName,
      subject: options.subject,
      body: options.body
    }

    return this.postBodyRequest({
      ...options,

      path,
      fields: body,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
