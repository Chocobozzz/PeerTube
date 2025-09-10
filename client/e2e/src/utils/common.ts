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

export async function prepareWebBrowser () {
  if (isMobileDevice()) return

  // Window size on chromium doesn't seem to work in "new" headless mode
  if (process.env.MOZ_HEADLESS_WIDTH) {
    await browser.setWindowSize(+process.env.MOZ_HEADLESS_WIDTH, +process.env.MOZ_HEADLESS_HEIGHT)
  }

  await browser.maximizeWindow()
}

export async function waitServerUp () {
  await browser.waitUntil(async () => {
    await go('/')
    await browserSleep(500)

    return $('<my-app>').isDisplayed()
  }, { timeout: 20 * 1000 })
}
