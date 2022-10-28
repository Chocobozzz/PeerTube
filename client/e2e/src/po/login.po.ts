import { go } from '../utils'

export class LoginPage {

  constructor (private isMobileDevice: boolean) {

  }

  async login (username: string, password: string, url = '/login') {
    await go(url)

    await browser.execute(`window.localStorage.setItem('no_account_setup_warning_modal', 'true')`)
    await browser.execute(`window.localStorage.setItem('no_instance_config_warning_modal', 'true')`)
    await browser.execute(`window.localStorage.setItem('no_welcome_modal', 'true')`)

    await $('input#username').setValue(username)
    await $('input#password').setValue(password)

    await browser.pause(1000)

    await $('form input[type=submit]').click()

    const menuToggle = $('.top-left-block span[role=button]')

    if (this.isMobileDevice) {
      await browser.pause(1000)

      await menuToggle.click()
    }

    await this.ensureIsLoggedInAs(username)

    if (this.isMobileDevice) {
      await menuToggle.click()
    }
  }

  async loginAsRootUser () {
    return this.login('root', 'test' + this.getSuffix())
  }

  loginOnPeerTube2 () {
    return this.login('e2e', process.env.PEERTUBE2_E2E_PASSWORD, 'https://peertube2.cpy.re/login')
  }

  async logout () {
    const loggedInMore = $('.logged-in-more')

    await loggedInMore.waitForClickable()
    await loggedInMore.click()

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
