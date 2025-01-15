import { browserSleep, getCheckbox, go, isCheckboxSelected } from '../utils'

export class AdminConfigPage {

  async navigateTo (tab: 'instance-homepage' | 'basic-configuration' | 'instance-information') {
    const waitTitles = {
      'instance-homepage': 'INSTANCE HOMEPAGE',
      'basic-configuration': 'APPEARANCE',
      'instance-information': 'INSTANCE'
    }
    await go('/admin/settings/config/edit-custom#' + tab)

    await $('h2=' + waitTitles[tab]).waitForDisplayed()
  }

  async updateNSFWSetting (newValue: 'do_not_list' | 'blur' | 'display') {
    const elem = $('#instanceDefaultNSFWPolicy')

    await elem.waitForDisplayed()
    await elem.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await elem.waitForClickable()

    return elem.selectByAttribute('value', newValue)
  }

  updateHomepage (newValue: string) {
    return $('#instanceCustomHomepageContent').setValue(newValue)
  }

  async toggleSignup (enabled: boolean) {
    if (await isCheckboxSelected('signupEnabled') === enabled) return

    const checkbox = await getCheckbox('signupEnabled')

    await checkbox.waitForClickable()
    await checkbox.click()
  }

  async toggleSignupApproval (required: boolean) {
    if (await isCheckboxSelected('signupRequiresApproval') === required) return

    const checkbox = await getCheckbox('signupRequiresApproval')

    await checkbox.waitForClickable()
    await checkbox.click()
  }

  async toggleSignupEmailVerification (required: boolean) {
    if (await isCheckboxSelected('signupRequiresEmailVerification') === required) return

    const checkbox = await getCheckbox('signupRequiresEmailVerification')

    await checkbox.waitForClickable()
    await checkbox.click()
  }

  async save () {
    const button = $('input[type=submit]')

    await button.waitForClickable()
    await button.click()

    await browserSleep(1000)
  }
}
