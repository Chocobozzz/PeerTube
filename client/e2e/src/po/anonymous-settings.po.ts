import { getCheckbox } from '../utils'

export class AnonymousSettingsPage {

  async openSettings () {
    const link = await $('my-header .settings-button')
    await link.waitForClickable()
    await link.click()

    await $('my-user-video-settings').waitForDisplayed()
  }

  async clickOnP2PCheckbox () {
    const p2p = await getCheckbox('p2pEnabled')
    await p2p.waitForClickable()

    await p2p.click()
  }
}
