import { browserSleep, go } from '../utils'

export class AdminPluginPage {

  async navigateToPluginSearch () {
    await go('/admin/settings/plugins/search')

    await $('my-plugin-search').waitForDisplayed()
  }

  async search (name: string) {
    const input = $('.search-bar input')
    await input.waitForDisplayed()
    await input.clearValue()
    await input.setValue(name)

    await browserSleep(1000)
  }

  async installHelloWorld () {
    $('.plugin-name=hello-world').waitForDisplayed()

    await $('.card-body my-button[icon=cloud-download]').click()

    const submitModalButton = $('.modal-content input[type=submit]')
    await submitModalButton.waitForClickable()
    await submitModalButton.click()

    await $('.card-body my-edit-button').waitForDisplayed()
  }
}
