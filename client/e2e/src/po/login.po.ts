import { go } from '../utils'

export class LoginPage {

  constructor (private isMobileDevice: boolean) {

  }

  async login (options: {
    username: string
    password: string
    displayName?: string
    url?: string
  }) {
    const { username, password, url = '/login', displayName = username } = options

    await go(url)

    await browser.execute(`window.localStorage.setItem('no_account_setup_warning_modal', 'true')`)
    await browser.execute(`window.localStorage.setItem('no_instance_config_warning_modal', 'true')`)
    await browser.execute(`window.localStorage.setItem('no_welcome_modal', 'true')`)

    await $('input#username').setValue(username)
    await $('input#password').setValue(password)

    await browser.pause(1000)

    await $('form input[type=submit]').click()

    if (this.isMobileDevice) {
      const menuToggle = $('.top-left-block span[role=button]')

      await $('h2=Our content selection').waitForDisplayed()

      await menuToggle.click()

      await this.ensureIsLoggedInAs(displayName)

      await menuToggle.click()
    } else {
      await this.ensureIsLoggedInAs(displayName)
    }
  }

  async getLoginError (username: string, password: string) {
    await go('/login')

    await $('input#username').setValue(username)
    await $('input#password').setValue(password)

    await browser.pause(1000)

    await $('form input[type=submit]').click()

    return $('.alert-danger').getText()
  }

  async loginAsRootUser () {
    return this.login({ username: 'root', password: 'test' + this.getSuffix() })
  }

  loginOnPeerTube2 () {
    return this.login({ username: 'e2e', password: process.env.PEERTUBE2_E2E_PASSWORD, url: 'https://peertube2.cpy.re/login' })
  }

  async logout () {
    const loggedInDropdown = $('.logged-in-more .logged-in-info')

    await loggedInDropdown.waitForClickable()
    await loggedInDropdown.click()

    const logout = $('.dropdown-item*=Log out')

    await logout.waitForClickable()
    await logout.click()

    await browser.waitUntil(() => {
      return $('.login-buttons-block, my-error-page a[href="/login"]').isDisplayed()
    })
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
