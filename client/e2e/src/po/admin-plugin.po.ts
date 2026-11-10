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

  async installHelloWorld (password: string) {
    await $('.plugin-name=hello-world').waitForDisplayed()

    await $('.card-body my-button[icon=cloud-download]').click()

    const passwordInput = $('.modal-content #confirmInput')
    await passwordInput.waitForDisplayed()
    await passwordInput.setValue(password)

    const submitModalButton = $('.modal-content input[type=submit]')
    await submitModalButton.waitForClickable()
    await submitModalButton.click()

    await $('.card-body my-edit-button').waitForDisplayed()
  }
}
