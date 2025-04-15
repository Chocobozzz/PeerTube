export function getVerificationLink (email: { text: string }) {
  const { text } = email

  const regexp = /\[(?<link>http:\/\/[^\]]+)\]/g
  const matched = text.matchAll(regexp)

  if (!matched) throw new Error('Could not find verification link in email')

  for (const match of matched) {
    const link = match.groups.link

    if (link.includes('/verify-account/')) {
      return link.replace('127.0.0.1', 'localhost')
    }
  }

  throw new Error('Could not find /verify-account/ link')
}

export function findEmailTo (emails: { text: string, to: { address: string }[] }[], to: string) {
  for (const email of emails) {
    for (const { address } of email.to) {
      if (address === to) return email
    }
  }

  return undefined
}

export async function getEmailPort () {
  const key = browser.options.baseUrl + '-emailPort'
  // FIXME: typings are wrong, get returns a promise
  // FIXME: use * because the key is not properly escaped by the shared store when using get(key)
  const emailPort = (await (browser.sharedStore.get('*') as unknown as Promise<number>))[key]
  if (!emailPort) throw new Error('Invalid email port')

  return emailPort
}
