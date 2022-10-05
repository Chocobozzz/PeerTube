import { Secret, TOTP } from 'otpauth'
import { WEBSERVER } from '@server/initializers/constants'

function isOTPValid (options: {
  secret: string
  token: string
}) {
  const { token, secret } = options

  const totp = new TOTP({
    ...baseOTPOptions(),

    secret
  })

  const delta = totp.validate({
    token,
    window: 1
  })

  if (delta === null) return false

  return true
}

function generateOTPSecret (email: string) {
  const totp = new TOTP({
    ...baseOTPOptions(),

    label: email,
    secret: new Secret()
  })

  return {
    secret: totp.secret.base32,
    uri: totp.toString()
  }
}

export {
  isOTPValid,
  generateOTPSecret
}

// ---------------------------------------------------------------------------

function baseOTPOptions () {
  return {
    issuer: WEBSERVER.HOST,
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  }
}
