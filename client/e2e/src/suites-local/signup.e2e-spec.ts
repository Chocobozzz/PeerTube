import { AdminConfigPage } from '../po/admin-config.po'
import { AdminRegistrationPage } from '../po/admin-registration.po'
import { LoginPage } from '../po/login.po'
import { SignupPage } from '../po/signup.po'
import {
  browserSleep,
  findEmailTo,
  getScreenshotPath,
  getVerificationLink,
  go,
  isMobileDevice,
  MockSMTPServer,
  waitServerUp
} from '../utils'

function checkEndMessage (options: {
  message: string
  requiresEmailVerification: boolean
  requiresApproval: boolean
  afterEmailVerification: boolean
}) {
  const { message, requiresApproval, requiresEmailVerification, afterEmailVerification } = options

  {
    const created = 'account has been created'
    const request = 'account request has been sent'

    if (requiresApproval) {
      expect(message).toContain(request)
      expect(message).not.toContain(created)
    } else {
      expect(message).not.toContain(request)
      expect(message).toContain(created)
    }
  }

  {
    const checkEmail = 'Check your email'

    if (requiresEmailVerification) {
      expect(message).toContain(checkEmail)
    } else {
      expect(message).not.toContain(checkEmail)

      const moderatorsApproval = 'moderator will check your registration request'
      if (requiresApproval) {
        expect(message).toContain(moderatorsApproval)
      } else {
        expect(message).not.toContain(moderatorsApproval)
      }
    }
  }

  {
    const emailVerified = 'email has been verified'

    if (afterEmailVerification) {
      expect(message).toContain(emailVerified)
    } else {
      expect(message).not.toContain(emailVerified)
    }
  }
}

describe('Signup', () => {
  let loginPage: LoginPage
  let adminConfigPage: AdminConfigPage
  let signupPage: SignupPage
  let adminRegistrationPage: AdminRegistrationPage

  async function prepareSignup (options: {
    enabled: boolean
    requiresApproval?: boolean
    requiresEmailVerification?: boolean
  }) {
    await loginPage.loginAsRootUser()

    await adminConfigPage.navigateTo('basic-configuration')
    await adminConfigPage.toggleSignup(options.enabled)

    if (options.enabled) {
      if (options.requiresApproval !== undefined) {
        await adminConfigPage.toggleSignupApproval(options.requiresApproval)
      }

      if (options.requiresEmailVerification !== undefined) {
        await adminConfigPage.toggleSignupEmailVerification(options.requiresEmailVerification)
      }
    }

    await adminConfigPage.save()

    await loginPage.logout()
    await browser.refresh()
  }

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    loginPage = new LoginPage(isMobileDevice())
    adminConfigPage = new AdminConfigPage()
    signupPage = new SignupPage()
    adminRegistrationPage = new AdminRegistrationPage()

    await browser.maximizeWindow()
  })

  describe('Signup disabled', function () {
    it('Should disable signup', async () => {
      await prepareSignup({ enabled: false })

      await expect(signupPage.getRegisterMenuButton()).not.toBeDisplayed()
    })
  })

  describe('Email verification disabled', function () {

    describe('Direct registration', function () {

      it('Should enable signup without approval', async () => {
        await prepareSignup({ enabled: true, requiresApproval: false, requiresEmailVerification: false })

        await signupPage.getRegisterMenuButton().waitForDisplayed()
      })

      it('Should go on signup page', async function () {
        await signupPage.clickOnRegisterButton()
      })

      it('Should validate the first step (about page)', async function () {
        await signupPage.validateStep()
      })

      it('Should validate the second step (terms)', async function () {
        await signupPage.checkTerms()
        await signupPage.validateStep()
      })

      it('Should validate the third step (account)', async function () {
        await signupPage.fillAccountStep({ username: 'user_1', displayName: 'user_1_dn' })

        await signupPage.validateStep()
      })

      it('Should validate the third step (channel)', async function () {
        await signupPage.fillChannelStep({ name: 'user_1_channel' })

        await signupPage.validateStep()
      })

      it('Should be logged in', async function () {
        await loginPage.ensureIsLoggedInAs('user_1_dn')
      })

      it('Should have a valid end message', async function () {
        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: false,
          requiresApproval: false,
          afterEmailVerification: false
        })

        await browser.saveScreenshot(getScreenshotPath('direct-without-email.png'))

        await loginPage.logout()
      })
    })

    describe('Registration with approval', function () {

      it('Should enable signup with approval', async () => {
        await prepareSignup({ enabled: true, requiresApproval: true, requiresEmailVerification: false })

        await signupPage.getRegisterMenuButton().waitForDisplayed()
      })

      it('Should go on signup page', async function () {
        await signupPage.clickOnRegisterButton()
      })

      it('Should validate the first step (about page)', async function () {
        await signupPage.validateStep()
      })

      it('Should validate the second step (terms)', async function () {
        await signupPage.checkTerms()
        await signupPage.fillRegistrationReason('my super reason')
        await signupPage.validateStep()
      })

      it('Should validate the third step (account)', async function () {
        await signupPage.fillAccountStep({ username: 'user_2', displayName: 'user_2 display name', password: 'password' })
        await signupPage.validateStep()
      })

      it('Should validate the third step (channel)', async function () {
        await signupPage.fillChannelStep({ name: 'user_2_channel' })
        await signupPage.validateStep()
      })

      it('Should have a valid end message', async function () {
        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: false,
          requiresApproval: true,
          afterEmailVerification: false
        })

        await browser.saveScreenshot(getScreenshotPath('request-without-email.png'))
      })

      it('Should display a message when trying to login with this account', async function () {
        const error = await loginPage.getLoginError('user_2', 'password')

        expect(error).toContain('awaiting approval')
      })

      it('Should accept the registration', async function () {
        await loginPage.loginAsRootUser()

        await adminRegistrationPage.navigateToRegistratonsList()
        await adminRegistrationPage.accept('user_2', 'moderation response')

        await loginPage.logout()
      })

      it('Should be able to login with this new account', async function () {
        await loginPage.login({ username: 'user_2', password: 'password', displayName: 'user_2 display name' })

        await loginPage.logout()
      })
    })
  })

  describe('Email verification enabled', function () {
    const emails: any[] = []
    let emailPort: number

    before(async () => {
      const key = browser.options.baseUrl + '-emailPort'
      // FIXME: typings are wrong, get returns a promise
      // FIXME: use * because the key is not properly escaped by the shared store when using get(key)
      emailPort = (await (browser.sharedStore.get('*') as unknown as Promise<number>))[key]

      await MockSMTPServer.Instance.collectEmails(emailPort, emails)
    })

    describe('Direct registration', function () {

      it('Should enable signup without approval', async () => {
        await prepareSignup({ enabled: true, requiresApproval: false, requiresEmailVerification: true })

        await signupPage.getRegisterMenuButton().waitForDisplayed()
      })

      it('Should go on signup page', async function () {
        await signupPage.clickOnRegisterButton()
      })

      it('Should validate the first step (about page)', async function () {
        await signupPage.validateStep()
      })

      it('Should validate the second step (terms)', async function () {
        await signupPage.checkTerms()
        await signupPage.validateStep()
      })

      it('Should validate the third step (account)', async function () {
        await signupPage.fillAccountStep({ username: 'user_3', displayName: 'user_3 display name', email: 'user_3@example.com' })

        await signupPage.validateStep()
      })

      it('Should validate the third step (channel)', async function () {
        await signupPage.fillChannelStep({ name: 'user_3_channel' })

        await signupPage.validateStep()
      })

      it('Should have a valid end message', async function () {
        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: true,
          requiresApproval: false,
          afterEmailVerification: false
        })

        await browser.saveScreenshot(getScreenshotPath('direct-with-email.png'))
      })

      it('Should validate the email', async function () {
        let email: { text: string }

        while (!(email = findEmailTo(emails, 'user_3@example.com'))) {
          await browserSleep(100)
        }

        await go(getVerificationLink(email))

        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: false,
          requiresApproval: false,
          afterEmailVerification: true
        })

        await browser.saveScreenshot(getScreenshotPath('direct-after-email.png'))
      })
    })

    describe('Registration with approval', function () {

      it('Should enable signup without approval', async () => {
        await prepareSignup({ enabled: true, requiresApproval: true, requiresEmailVerification: true })

        await signupPage.getRegisterMenuButton().waitForDisplayed()
      })

      it('Should go on signup page', async function () {
        await signupPage.clickOnRegisterButton()
      })

      it('Should validate the first step (about page)', async function () {
        await signupPage.validateStep()
      })

      it('Should validate the second step (terms)', async function () {
        await signupPage.checkTerms()
        await signupPage.fillRegistrationReason('my super reason 2')
        await signupPage.validateStep()
      })

      it('Should validate the third step (account)', async function () {
        await signupPage.fillAccountStep({
          username: 'user_4',
          displayName: 'user_4 display name',
          email: 'user_4@example.com',
          password: 'password'
        })
        await signupPage.validateStep()
      })

      it('Should validate the third step (channel)', async function () {
        await signupPage.fillChannelStep({ name: 'user_4_channel' })
        await signupPage.validateStep()
      })

      it('Should have a valid end message', async function () {
        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: true,
          requiresApproval: true,
          afterEmailVerification: false
        })

        await browser.saveScreenshot(getScreenshotPath('request-with-email.png'))
      })

      it('Should display a message when trying to login with this account', async function () {
        const error = await loginPage.getLoginError('user_4', 'password')

        expect(error).toContain('awaiting approval')
      })

      it('Should accept the registration', async function () {
        await loginPage.loginAsRootUser()

        await adminRegistrationPage.navigateToRegistratonsList()
        await adminRegistrationPage.accept('user_4', 'moderation response 2')

        await loginPage.logout()
      })

      it('Should validate the email', async function () {
        let email: { text: string }

        while (!(email = findEmailTo(emails, 'user_4@example.com'))) {
          await browserSleep(100)
        }

        await go(getVerificationLink(email))

        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: false,
          requiresApproval: true,
          afterEmailVerification: true
        })

        await browser.saveScreenshot(getScreenshotPath('request-after-email.png'))
      })
    })

    after(() => {
      MockSMTPServer.Instance.kill()
    })
  })
})
