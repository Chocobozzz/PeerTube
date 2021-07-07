type From = string | { name?: string, address: string }

interface Base extends Partial<SendEmailDefaultMessageOptions> {
  to: string[] | string
}

interface MailTemplate extends Base {
  template: string
  locals?: { [key: string]: any }
  text?: undefined
}

interface MailText extends Base {
  text: string

  locals?: Partial<SendEmailDefaultLocalsOptions> & {
    title?: string
    action?: {
      url: string
      text: string
    }
  }
}

interface SendEmailDefaultLocalsOptions {
  instanceName: string
  text: string
  subject: string
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
    EMAIL: any
  }
}

export type SendEmailOptions = MailTemplate | MailText
