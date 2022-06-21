import { getCheckbox } from '../utils'

export class SignupPage {

  getRegisterMenuButton () {
    return $('.create-account-button')
  }

  async clickOnRegisterInMenu () {
    const button = this.getRegisterMenuButton()

    await button.waitForDisplayed()
    await button.click()
  }

  async validateStep () {
    const next = $('button[type=submit]')

    await next.waitForClickable()
    await next.click()
  }

  async checkTerms () {
    const terms = await getCheckbox('terms')

    return terms.click()
  }

  async fillAccountStep (options: {
    displayName: string
    username: string
    email: string
    password: string
  }) {
    if (options.displayName) {
      await $('#displayName').setValue(options.displayName)
    }

    if (options.username) {
      await $('#username').setValue(options.username)
    }

    if (options.email) {
      await $('#email').setValue(options.email)
    }

    if (options.password) {
      await $('#password').setValue(options.password)
    }
  }

  async fillChannelStep (options: {
    displayName: string
    name: string
  }) {
    if (options.displayName) {
      await $('#displayName').setValue(options.displayName)
    }

    if (options.name) {
      await $('#name').setValue(options.name)
    }
  }
}
