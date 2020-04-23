export type SendEmailOptions = {
  to: string[]
  subject: string
  text: string

  fromDisplayName?: string
  replyTo?: string
}
