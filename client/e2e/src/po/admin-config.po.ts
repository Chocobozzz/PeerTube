import { browserSleep, go } from '../utils'

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

  async save () {
    await $('input[type=submit]').click()
    await browserSleep(200)
  }
}
