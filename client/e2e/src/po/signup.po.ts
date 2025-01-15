import { getCheckbox } from '../utils'

export class SignupPage {

  getRegisterMenuButton () {
    return $('.create-account-button')
  }

  async clickOnRegisterButton () {
    const button = this.getRegisterMenuButton()

    await button.waitForClickable()
    await button.click()
  }

  async validateStep () {
    const next = $('button[type=submit]')

    await next.waitForClickable()
    await next.click()
  }

  async checkTerms () {
    const terms = await getCheckbox('terms')
    await terms.waitForClickable()

    return terms.click()
  }

  async getEndMessage () {
    const alert = $('.pt-alert-primary')
    await alert.waitForDisplayed()

    return alert.getText()
  }

  async fillRegistrationReason (reason: string) {
    await $('#registrationReason').setValue(reason)
  }

  async fillAccountStep (options: {
    username: string
    password?: string
    displayName?: string
    email?: string
  }) {
    await $('#displayName').setValue(options.displayName || `${options.username} display name`)

    await $('#username').setValue(options.username)
    await $('#password').setValue(options.password || 'password')

    // Fix weird bug on firefox that "cannot scroll into view" when using just `setValue`
    await $('#email').scrollIntoView({ block: 'center' })
    await $('#email').waitForClickable()
    await $('#email').setValue(options.email || `${options.username}@example.com`)
  }

  async fillChannelStep (options: {
    name: string
    displayName?: string
  }) {
    await $('#displayName').setValue(options.displayName || `${options.name} channel display name`)
    await $('#name').setValue(options.name)
  }

  async fullSignup ({ accountInfo, channelInfo }: {
    accountInfo: {
      username: string
      password?: string
      displayName?: string
      email?: string
    }
    channelInfo: {
      name: string
    }
  }) {
    await this.clickOnRegisterButton()
    await this.validateStep()
    await this.checkTerms()
    await this.validateStep()
    await this.fillAccountStep(accountInfo)
    await this.validateStep()
    await this.fillChannelStep(channelInfo)
    await this.validateStep()
    await this.getEndMessage()
  }
}
