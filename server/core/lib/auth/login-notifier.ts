import { GeoIP } from '@server/helpers/geo-ip.js'
import { CONFIG, isEmailEnabled } from '@server/initializers/config.js'
import { Emailer } from '@server/lib/emailer.js'
import { UserLoginDeviceModel } from '@server/models/user/user-login-device.js'
import { MUserDefault } from '@server/types/models/index.js'

async function notifyOnLoginSuccess (options: {
  user: MUserDefault
  ip: string
  userAgent: string
}) {
  const { user, ip, userAgent } = options

  const isNewDevice = await UserLoginDeviceModel.registerDevice({ userId: user.id, ip, userAgent })
  if (!isNewDevice) return

  if (!isEmailEnabled()) return
  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) return

  Emailer.Instance.addLoginSuccessEmailJob({
    username: user.username,
    email: user.email,
    language: user.getLanguage(),
    ip,
    device: await buildDevice(userAgent),
    location: await buildLocation(ip)
  })
}

export {
  notifyOnLoginSuccess
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function buildLocation (ip: string) {
  if (!ip) return undefined

  const { country, subdivisionName } = await GeoIP.Instance.safeIPISOLookup(ip)

  return [ subdivisionName, country ].filter(v => !!v).join(', ') || undefined
}

// Build a human readable device description, since a raw user agent is difficult to read and understand
async function buildDevice (userAgent: string) {
  if (!userAgent) return undefined

  const { UAParser } = await import('ua-parser-js')
  const { browser, os } = UAParser(userAgent)

  const browserName = [ browser.name, browser.version ].filter(v => !!v).join(' ')
  const osName = [ os.name, os.version ].filter(v => !!v).join(' ')

  return [ browserName, osName ].filter(v => !!v).join(' - ') || userAgent
}
