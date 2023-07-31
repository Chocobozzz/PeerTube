import { Secret, TOTP } from 'otpauth'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { decrypt } from './peertube-crypto.js'

async function isOTPValid (options: {
  encryptedSecret: string
  token: string
}) {
  const { token, encryptedSecret } = options

  const secret = await decrypt(encryptedSecret, CONFIG.SECRETS.PEERTUBE)

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
