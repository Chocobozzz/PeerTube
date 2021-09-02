import { go } from '../utils'

export class LoginPage {
  async loginAsRootUser () {
    await go('/login')

    await browser.execute(`window.localStorage.setItem('no_instance_config_warning_modal', 'true')`)
    await browser.execute(`window.localStorage.setItem('no_welcome_modal', 'true')`)

    await $('input#username').setValue('root')
    await $('input#password').setValue('test1')

    await browser.pause(1000)

    await $('form input[type=submit]').click()

    await this.getLoggedInInfoElem().waitForExist()

    await expect(this.getLoggedInInfoElem()).toHaveText('root')
  }

  private getLoggedInInfoElem () {
    return $('.logged-in-display-name')
  }
}
