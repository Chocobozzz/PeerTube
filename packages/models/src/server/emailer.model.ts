export type To = { email: string, language: string }
type From = string | { name?: string, address: string }

interface Base {
  to: To[] | To

  from?: From
  subject?: string
  replyTo?: string
}

interface MailTemplate extends Base {
  template: string
  locals?: { [key: string]: any }
  text?: undefined
}

export interface MailAction {
  url: string
  text: string
}

interface MailText extends Base {
  text: string

  locals?: Partial<SendEmailDefaultLocalsOptions> & {
    title?: string
    action?: MailAction
  }
}

interface SendEmailDefaultLocalsOptions {
  instanceName: string
  text: string
  subject: string

  fg: string
  bg: string
  primary: string
  language: string
  logoUrl: string
}

interface SendEmailDefaultMessageOptions {
  to: string[] | string
  from: From
  subject: string
  replyTo: string
}

export type SendEmailDefaultOptions = {
  template: 'common'

  message: SendEmailDefaultMessageOptions

  locals: SendEmailDefaultLocalsOptions & {
    WEBSERVER: any
    signature: string
  }
}

export type SendEmailOptions = MailTemplate | MailText
