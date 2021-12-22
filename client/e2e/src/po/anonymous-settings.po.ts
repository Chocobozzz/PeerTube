import { getCheckbox } from '../utils'

export class AnonymousSettingsPage {

  async openSettings () {
    const link = await $$('.menu-link').filter(async i => {
      return await i.getText() === 'My settings'
    }).then(links => links[0])

    await link.click()

    await $('my-user-video-settings').waitForDisplayed()
  }

  async clickOnP2PCheckbox () {
    const p2p = await getCheckbox('p2pEnabled')
    await p2p.waitForClickable()

    await p2p.click()
  }
}
