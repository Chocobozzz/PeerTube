import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { ContactForm } from '../../models/server'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

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
      token: null,
      fields: body,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
