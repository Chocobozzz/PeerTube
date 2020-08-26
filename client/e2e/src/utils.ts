import { browser } from 'protractor'

async function browserSleep (amount: number) {
  const oldValue = await browser.waitForAngularEnabled()

  // iOS does not seem to work with protractor
  // https://github.com/angular/protractor/issues/2840
  if (await isIOS()) browser.waitForAngularEnabled(true)

  await browser.sleep(amount)

  if (await isIOS()) browser.waitForAngularEnabled(oldValue)
}

async function isMobileDevice () {
  const caps = await browser.getCapabilities()
  return caps.get('realMobile') === 'true' || caps.get('realMobile') === true
}

async function isSafari () {
  const caps = await browser.getCapabilities()
  return caps.get('browserName') && caps.get('browserName').toLowerCase() === 'safari'
}

async function isIOS () {
  return await isMobileDevice() && await isSafari()
}

export  {
  isMobileDevice,
  isSafari,
  isIOS,
  browserSleep
}
