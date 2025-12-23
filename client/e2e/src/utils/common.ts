export async function browserSleep (amount: number) {
  await browser.pause(amount)
}

// ---------------------------------------------------------------------------

export function isMobileDevice () {
  const platformName = (browser.capabilities['platformName'] || '').toLowerCase()

  return platformName === 'android' || platformName === 'ios'
}

export function isAndroid () {
  const platformName = (browser.capabilities['platformName'] || '').toLowerCase()

  return platformName === 'android'
}

export function isSafari () {
  return browser.capabilities['browserName'] &&
    browser.capabilities['browserName'].toLowerCase() === 'safari'
}

export function isIOS () {
  return isMobileDevice() && isSafari()
}

export async function go (url: string) {
  await browser.url(url)

  await browser.execute(() => {
    const style = document.createElement('style')
    style.innerHTML = 'p-toast { display: none }'
    document.head.appendChild(style)
  })
}

// ---------------------------------------------------------------------------

export async function prepareWebBrowser (options: {
  hidePrivacyConcerns?: boolean // default true
} = {}) {
  const { hidePrivacyConcerns = true } = options

  if (hidePrivacyConcerns) {
    try {
      await browser.execute(() => {
        localStorage.setItem('video-watch-privacy-concern', 'true')
      })
    } catch {
      console.log('Cannot set local storage to hide privacy concerns')
    }
  }

  if (!isMobileDevice() && process.env.MOZ_HEADLESS_WIDTH) {
    await browser.setWindowSize(+process.env.MOZ_HEADLESS_WIDTH, +process.env.MOZ_HEADLESS_HEIGHT)
  }
}

export async function waitServerUp () {
  await browser.waitUntil(async () => {
    await go('/')
    await browserSleep(500)

    return $('<my-app>').isDisplayed()
  }, { timeout: 20 * 1000 })
}
