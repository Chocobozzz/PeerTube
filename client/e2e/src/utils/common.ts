async function browserSleep (amount: number) {
  await browser.pause(amount)
}

function isMobileDevice () {
  const platformName = (browser.capabilities['platformName'] || '').toLowerCase()

  return platformName === 'android' || platformName === 'ios'
}

function isAndroid () {
  const platformName = (browser.capabilities['platformName'] || '').toLowerCase()

  return platformName === 'android'
}

function isSafari () {
  return browser.capabilities['browserName'] &&
         browser.capabilities['browserName'].toLowerCase() === 'safari'
}

function isIOS () {
  return isMobileDevice() && isSafari()
}

async function go (url: string) {
  await browser.url(url)

  await browser.execute(() => {
    const style = document.createElement('style')
    style.innerHTML = 'p-toast { display: none }'
    document.head.appendChild(style)
  })
}

async function waitServerUp () {
  await browser.waitUntil(async () => {
    await go('/')
    await browserSleep(500)

    return $('<my-app>').isDisplayed()
  }, { timeout: 20 * 1000 })
}

export {
  isMobileDevice,
  isSafari,
  isIOS,
  isAndroid,
  waitServerUp,
  go,
  browserSleep
}
