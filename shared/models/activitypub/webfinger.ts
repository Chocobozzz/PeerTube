export interface WebFingerData {
  subject: string
  aliases: string[]
  links: {
    rel: 'self'
    type: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    href: string
  }[]
}
