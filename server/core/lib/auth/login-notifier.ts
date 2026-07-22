import { UserNotificationSettingValue } from '@peertube/peertube-models'
import { GeoIP } from '@server/helpers/geo-ip.js'
import { CONFIG, isEmailEnabled } from '@server/initializers/config.js'
import { Emailer } from '@server/lib/emailer.js'
import { MUserDefault } from '@server/types/models/index.js'

async function buildLocation (ip: string) {
  if (!ip) return undefined

  const { country, subdivisionName } = await GeoIP.Instance.safeIPISOLookup(ip)

  return [ subdivisionName, country ].filter(v => !!v).join(', ') || undefined
}

async function notifyOnLoginSuccess (options: {
  user: MUserDefault
  ip: string
  userAgent: string
  isNewDevice: boolean
}) {
  const { user, ip, userAgent, isNewDevice } = options

  if (!isEmailEnabled()) return
  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) return

  const settingValue = user.NotificationSetting.newLoginSuccess
  if ((settingValue & UserNotificationSettingValue.EMAIL) !== UserNotificationSettingValue.EMAIL) return

  Emailer.Instance.addLoginSuccessEmailJob({
    username: user.username,
    email: user.email,
    language: user.getLanguage(),
    ip,
    userAgent,
    newDevice: isNewDevice,
    location: await buildLocation(ip)
  })
}

export {
  notifyOnLoginSuccess
}
