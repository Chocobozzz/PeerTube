import { getCheckbox, go } from '../utils'

export class AdminConfigPage {

  async navigateTo (tab: 'instance-homepage' | 'basic-configuration' | 'instance-information') {
    const waitTitles = {
      'instance-homepage': 'INSTANCE HOMEPAGE',
      'basic-configuration': 'APPEARANCE',
      'instance-information': 'INSTANCE'
    }

    await go('/admin/config/edit-custom#' + tab)

    await $('.inner-form-title=' + waitTitles[tab]).waitForDisplayed()
  }

  updateNSFWSetting (newValue: 'do_not_list' | 'blur' | 'display') {
    return $('#instanceDefaultNSFWPolicy').selectByAttribute('value', newValue)
  }

  updateHomepage (newValue: string) {
    return $('#instanceCustomHomepageContent').setValue(newValue)
  }

  async toggleSignup () {
    const checkbox = await getCheckbox('signupEnabled')
    await checkbox.click()
  }

  async save () {
    const button = $('input[type=submit]')
    await button.click()
  }
}
