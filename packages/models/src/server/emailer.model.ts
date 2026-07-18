export type MailTo = { email: string, language: string }
export type MailFrom = string | { name?: string, address: string }

export interface MailAction {
  url: string
  text: string
}

interface MailBase {
  to: MailTo[] | MailTo

  from?: MailFrom
  subject?: string
  replyTo?: string
}

export interface MailBaseLocals {
  title?: string
  action?: MailAction
}

interface SendMailTemplateOptions extends MailBase, Partial<MailBaseLocals> {
  template: string
  locals?: Record<string, any>

  // text is forbidden if template is used
  text?: undefined
}

interface SendMailTextOptions extends MailBase, Partial<MailBaseLocals> {
  text: string

  // locals is forbidden if template is used
  locals?: undefined
  // template is forbidden if template is used
  template?: undefined
}

export type SendEmailOptions = SendMailTemplateOptions | SendMailTextOptions
