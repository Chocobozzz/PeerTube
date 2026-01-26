import { NSFWPolicyType } from '@peertube/peertube-models'
import { getCheckbox } from '../utils'

export class AnonymousSettingsPage {
  async openSettings () {
    const link = $('my-header .settings-button')
    await link.waitForClickable()
    await link.click()

    await $('my-user-video-settings').waitForDisplayed()
  }

  async closeSettings () {
    const closeModal = $('.modal.show .modal-header > button')
    await closeModal.waitForClickable()
    await closeModal.click()

    await $('.modal.show').waitForDisplayed({ reverse: true })
  }

  async clickOnP2PCheckbox () {
    const p2p = await getCheckbox('p2pEnabled')
    await p2p.waitForClickable()

    await p2p.click()
  }

  async updateNSFW (newValue: NSFWPolicyType) {
    const nsfw = $(`#nsfwPolicy-${newValue} + label`)

    await nsfw.waitForClickable()
    await nsfw.click()

    await $(`#nsfwPolicy-${newValue}:checked`).waitForExist()
  }

  async updateViolentFlag (newValue: NSFWPolicyType) {
    const nsfw = $(`#nsfwFlagViolent-${newValue} + label`)

    await nsfw.waitForClickable()
    await nsfw.click()

    await $(`#nsfwFlagViolent-${newValue}:checked`).waitForExist()
  }
}
