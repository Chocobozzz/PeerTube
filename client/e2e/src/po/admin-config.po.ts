import { NSFWPolicyType } from '@peertube/peertube-models'
import { browserSleep, go, setCheckboxEnabled } from '../utils'

export class AdminConfigPage {
  async navigateTo (tab: 'instance-homepage' | 'basic-configuration' | 'instance-information' | 'live') {
    const waitTitles = {
      'instance-homepage': 'INSTANCE HOMEPAGE',
      'basic-configuration': 'APPEARANCE',
      'instance-information': 'INSTANCE',
      'live': 'LIVE'
    }

    const url = '/admin/settings/config/edit-custom#' + tab

    if (await browser.getUrl() !== url) {
      await go('/admin/settings/config/edit-custom#' + tab)
    }

    await $('h2=' + waitTitles[tab]).waitForDisplayed()
  }

  async updateNSFWSetting (newValue: NSFWPolicyType) {
    await this.navigateTo('instance-information')

    const elem = $(`#instanceDefaultNSFWPolicy-${newValue} + label`)

    await elem.waitForDisplayed()
    await elem.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await elem.waitForClickable()

    return elem.click()
  }

  async updateHomepage (newValue: string) {
    await this.navigateTo('instance-homepage')

    return $('#instanceCustomHomepageContent').setValue(newValue)
  }

  async toggleSignup (enabled: boolean) {
    await this.navigateTo('basic-configuration')

    return setCheckboxEnabled('signupEnabled', enabled)
  }

  async toggleSignupApproval (required: boolean) {
    await this.navigateTo('basic-configuration')

    return setCheckboxEnabled('signupRequiresApproval', required)
  }

  async toggleSignupEmailVerification (required: boolean) {
    await this.navigateTo('basic-configuration')

    return setCheckboxEnabled('signupRequiresEmailVerification', required)
  }

  async toggleLive (enabled: boolean) {
    await this.navigateTo('live')

    return setCheckboxEnabled('liveEnabled', enabled)
  }

  async save () {
    const button = $('input[type=submit]')

    await button.waitForClickable()
    await button.click()

    await browserSleep(1000)
  }
}
