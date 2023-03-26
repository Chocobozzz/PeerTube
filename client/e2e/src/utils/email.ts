function getVerificationLink (email: { text: string }) {
  const { text } = email

  const regexp = /\[(?<link>http:\/\/[^\]]+)\]/g
  const matched = text.matchAll(regexp)

  if (!matched) throw new Error('Could not find verification link in email')

  for (const match of matched) {
    const link = match.groups.link

    if (link.includes('/verify-account/')) return link
  }

  throw new Error('Could not find /verify-account/ link')
}

function findEmailTo (emails: { text: string, to: { address: string }[] }[], to: string) {
  for (const email of emails) {
    for (const { address } of email.to) {
      if (address === to) return email
    }
  }

  return undefined
}

export {
  getVerificationLink,
  findEmailTo
}
