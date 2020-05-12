import { browser } from 'protractor'

async function browserSleep (amount: number) {
  if (await isIOS()) browser.ignoreSynchronization = false

  await browser.sleep(amount)

  if (await isIOS()) browser.ignoreSynchronization = true
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
