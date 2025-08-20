import { NSFWPolicyType } from '@peertube/peertube-models'
import { browserSleep, go, setCheckboxEnabled } from '../utils'

export class AdminConfigPage {
  async navigateTo (page: 'information' | 'live' | 'general' | 'homepage') {
    const url = '/admin/settings/config/' + page

    if (await browser.getUrl() !== url) {
      await go(url)
    }

    await $('a.active[href=' + url + ']').waitForDisplayed()
  }

  async updateNSFWSetting (newValue: NSFWPolicyType) {
    await this.navigateTo('information')

    const elem = $(`#instanceDefaultNSFWPolicy-${newValue} + label`)

    await elem.waitForDisplayed()
    await elem.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await elem.waitForClickable()

    return elem.click()
  }

  async updateHomepage (newValue: string) {
    await this.navigateTo('homepage')

    return $('#instanceCustomHomepageContent').setValue(newValue)
  }

  async toggleSignup (enabled: boolean) {
    await this.navigateTo('general')

    return setCheckboxEnabled('signupEnabled', enabled)
  }

  async toggleSignupApproval (required: boolean) {
    await this.navigateTo('general')

    return setCheckboxEnabled('signupRequiresApproval', required)
  }

  async toggleSignupEmailVerification (required: boolean) {
    await this.navigateTo('general')

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
