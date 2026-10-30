import { HTMLServerConfig } from '@peertube/peertube-models'
import { isAndroid, isIphone } from '@root-helpers/web-browser'

type OpenInAppConfig = HTMLServerConfig['client']['openInApp']

export function canOpenMobileApp (config: OpenInAppConfig) {
  if (isAndroid()) return config.android.intent.enabled !== false
  if (isIphone()) return config.ios.enabled !== false

  return false
}

// appPath is the path of the app deep link, including the host query param (e.g. /video/123?host=example.com)
// Returns undefined if the app cannot be opened on this device
export function buildMobileAppUrl (config: OpenInAppConfig, appPath: string) {
  if (!canOpenMobileApp(config)) return undefined

  if (isAndroid()) {
    const intent = config.android.intent

    return `intent://${intent.host}${appPath}#Intent;scheme=${intent.scheme};S.browser_fallback_url=${intent.fallbackUrl};end`
  }

  return `${config.ios.scheme}://${config.ios.host}${appPath}`
}

export function buildMobileAppLoginPath (options: {
  afterSignup: boolean // User just verified the email of an account created from the app
  username?: string // Hint to autofill the login form
}) {
  const path = options.afterSignup
    ? '/signup-verified'
    : '/login-redirect'

  const query = options.username
    ? `?host=${window.location.host}&username=${encodeURIComponent(options.username)}`
    : `?host=${window.location.host}`

  return path + query
}

// On iOS, the deep link does nothing if the app is not installed: open the fallback URL instead
export function openMobileAppFallbackOnIOS (config: OpenInAppConfig) {
  if (!isIphone()) return

  const timeout = setTimeout(() => {
    window.location.href = config.ios.fallbackUrl
  }, 2500)

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timeout)
  }, { once: true })
}
