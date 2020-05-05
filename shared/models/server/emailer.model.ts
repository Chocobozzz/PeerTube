export type SendEmailOptions = {
  to: string[]

  template?: string
  locals?: { [key: string]: any }

  // override defaults
  subject?: string
  text?: string
  from?: string | { name?: string, address: string }
  replyTo?: string
}
