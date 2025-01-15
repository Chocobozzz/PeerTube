import { browserSleep, go, isAndroid } from '../utils'

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

    await browserSleep(1000)

    const submit = $('.login-form-and-externals > form input[type=submit]')
    await submit.click()

    // Have to do this on Android, don't really know why
    // I think we need to "escape" from the password input, so click twice on the submit button
    if (isAndroid()) {
      await browserSleep(2000)
      await submit.click()
    }

    await this.ensureIsLoggedInAs(displayName)
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
    if (!process.env.PEERTUBE2_E2E_PASSWORD) {
      throw new Error('PEERTUBE2_E2E_PASSWORD env is missing for user e2e on peertube2.cpy.re')
    }

    return this.login({ username: 'e2e', password: process.env.PEERTUBE2_E2E_PASSWORD, url: 'https://peertube2.cpy.re/login' })
  }

  async logout () {
    const loggedInDropdown = $('.logged-in-container .logged-in-info')

    await loggedInDropdown.waitForClickable()
    await loggedInDropdown.click()

    const logout = $('.dropdown-item*=Log out')

    await logout.waitForClickable()
    await logout.click()

    await browser.waitUntil(() => {
      return $$('my-login-link, my-error-page a[href="/login"]').some(e => e.isDisplayed())
    })
  }

  async ensureIsLoggedInAs (displayName: string) {
    await this.getLoggedInInfoElem(displayName).waitForExist()
  }

  private getLoggedInInfoElem (displayName: string) {
    return $('.logged-in-info').$('.display-name*=' + displayName)
  }

  private getSuffix () {
    return browser.options.baseUrl
      ? browser.options.baseUrl.slice(-1)
      : '1'
  }
}
