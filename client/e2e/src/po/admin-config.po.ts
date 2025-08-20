import { NSFWPolicyType } from '@peertube/peertube-models'
import { browserSleep, go, setCheckboxEnabled } from '../utils'

export class AdminConfigPage {
  async navigateTo (page: 'information' | 'live' | 'general' | 'homepage') {
    const url = '/admin/settings/config/' + page

    const currentUrl = await browser.getUrl()
    if (!currentUrl.endsWith(url)) {
      await go(url)
    }

    await $('a.active[href="' + url + '"]').waitForDisplayed()
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

    return $('#homepageContent').setValue(newValue)
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
    const button = $('my-admin-save-bar .save-button')

    try {
      await button.waitForClickable()
    } catch {
      // The config may have not been changed
      return
    } finally {
      await browserSleep(1000) // Wait for the button to be clickable
    }

    await button.click()
    await button.waitForClickable({ reverse: true })
  }
}
