import { browserSleep } from './common'

type MockEmail = { text: string, to: { address: string }[] }

export function getVerificationLink (email: { text: string }) {
  return getEmailLink(email, '/verify-account/')
}

export function getLoginLink (email: { text: string }) {
  return getEmailLink(email, '/login')
}

export function findEmailTo (emails: MockEmail[], to: string, textContains?: string) {
  for (const email of emails) {
    if (textContains && !email.text.includes(textContains)) continue

    for (const { address } of email.to) {
      if (address === to) return email
    }
  }

  return undefined
}

export async function waitEmailTo (emails: MockEmail[], to: string, textContains?: string) {
  const timeout = 20000
  let email: MockEmail

  for (let elapsed = 0; !(email = findEmailTo(emails, to, textContains)); elapsed += 100) {
    if (elapsed > timeout) {
      const received = emails.filter(e => e.to.some(({ address }) => address === to)).map(e => e.text)

      throw new Error(`No email to ${to} containing "${textContains}". Received: ${JSON.stringify(received, null, 2)}`)
    }

    await browserSleep(100)
  }

  return email
}

export async function getEmailPort () {
  const key = browser.options.baseUrl + '-emailPort'
  // FIXME: typings are wrong, get returns a promise
  // FIXME: use * because the key is not properly escaped by the shared store when using get(key)
  const emailPort = (await (browser.sharedStore.get('*') as unknown as Promise<number>))[key]
  if (!emailPort) throw new Error('Invalid email port')

  return emailPort
}

// ---------------------------------------------------------------------------

function getEmailLink (email: { text: string }, path: string) {
  const regexp = /\[(?<link>http:\/\/[^\]]+)\]/g

  for (const match of email.text.matchAll(regexp)) {
    const link = match.groups.link

    if (link.includes(path)) {
      return link.replace('127.0.0.1', 'localhost')
    }
  }

  throw new Error(`Could not find ${path} link in email`)
}
