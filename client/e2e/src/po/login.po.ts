import { go } from '../utils'

export class LoginPage {

  async loginAsRootUser () {
    await go('/login')

    await browser.execute(`window.localStorage.setItem('no_instance_config_warning_modal', 'true')`)
    await browser.execute(`window.localStorage.setItem('no_welcome_modal', 'true')`)

    await $('input#username').setValue('root')
    await $('input#password').setValue('test' + this.getSuffix())

    await browser.pause(1000)

    await $('form input[type=submit]').click()

    await this.ensureIsLoggedInAs('root')
  }

  async logout () {
    await $('.logged-in-more').click()

    const logout = () => $('.dropdown-item*=Log out')

    await logout().waitForDisplayed()
    await logout().click()

    await $('.login-buttons-block').waitForDisplayed()
  }

  async ensureIsLoggedInAs (displayName: string) {
    await this.getLoggedInInfoElem().waitForExist()

    await expect(this.getLoggedInInfoElem()).toHaveText(displayName)
  }

  private getLoggedInInfoElem () {
    return $('.logged-in-display-name')
  }

  private getSuffix () {
    return browser.config.baseUrl
      ? browser.config.baseUrl.slice(-1)
      : '1'
  }
}
