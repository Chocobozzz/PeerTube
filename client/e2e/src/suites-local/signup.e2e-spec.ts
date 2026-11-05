import { AdminConfigPage } from '../po/admin-config.po'
import { AdminRegistrationPage } from '../po/admin-registration.po'
import { LoginPage } from '../po/login.po'
import { SignupPage } from '../po/signup.po'
import {
  getEmailPort,
  getLoginLink,
  getScreenshotPath,
  getVerificationLink,
  go,
  MockSMTPServer,
  prepareWebBrowser,
  waitEmailTo,
  waitServerUp
} from '../utils'

const ANDROID_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/130.0.0.0 Mobile Safari/537.36'
const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
  'Version/18.0 Mobile/15E148 Safari/604.1'

// Simulate a signup from the PeerTube mobile app
async function registerFromApp (options: {
  username: string
  password: string
  registrationReason?: string
}) {
  const res = await fetch(browser.options.baseUrl + '/api/v1/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...options,

      email: `${options.username}@example.com`,
      displayName: `${options.username} display name`,
      signupClient: 'peertube-app'
    })
  })

  if (res.status !== 200) throw new Error(`Cannot register ${options.username}: ${res.status} ${await res.text()}`)
}

// The mobile app message is displayed in the header for mobile user agents with a mobile screen size
async function withMobileBrowser (userAgent: string, fn: () => Promise<void>) {
  const windowSize = await browser.getWindowSize()

  const restoreUserAgent = await browser.emulate('userAgent', userAgent)
  await browser.setWindowSize(400, 900)

  try {
    await fn()
  } finally {
    await restoreUserAgent()
    await browser.setWindowSize(windowSize.width, windowSize.height)
  }
}

function getHost () {
  return new URL(browser.options.baseUrl).host
}

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

    // Ensure we change the state of the form to "dirty" so we can save the form
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
    loginPage = new LoginPage()
    adminConfigPage = new AdminConfigPage()
    signupPage = new SignupPage()
    adminRegistrationPage = new AdminRegistrationPage()

    await prepareWebBrowser()
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
        await signupPage.fillAccountStep({ username: 'user_2', displayName: 'user_2 display name', password: 'superpassword' })
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
        const error = await loginPage.getLoginError('user_2', 'superpassword')

        expect(error).toContain('awaiting approval')
      })

      it('Should accept the registration', async function () {
        await loginPage.loginAsRootUser()

        await adminRegistrationPage.navigateToRegistrationsList()
        await adminRegistrationPage.accept('user_2', 'moderation response')

        await loginPage.logout()
      })

      it('Should be able to login with this new account', async function () {
        await loginPage.login({ username: 'user_2', password: 'superpassword', displayName: 'user_2 display name' })

        await loginPage.logout()
      })
    })
  })

  describe('Email verification enabled', function () {
    const emails: any[] = []

    before(async () => {
      await MockSMTPServer.Instance.collectEmails(await getEmailPort(), emails)
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
        const email = await waitEmailTo(emails, 'user_3@example.com')

        await go(getVerificationLink(email))

        const message = await signupPage.getEndMessage()

        checkEndMessage({
          message,
          requiresEmailVerification: false,
          requiresApproval: false,
          afterEmailVerification: true
        })

        const button = await signupPage.getEndMessageButton()
        expect(button.text).toBe('Log in')
        expect(button.href).toMatch(/\/login$/)

        await browser.saveScreenshot(getScreenshotPath('direct-after-email.png'))
      })
    })

    describe('Registration with approval', function () {
      it('Should enable signup with approval', async () => {
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
          password: 'superpassword'
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
        const error = await loginPage.getLoginError('user_4', 'superpassword')

        expect(error).toContain('awaiting approval')
      })

      it('Should accept the registration', async function () {
        await loginPage.loginAsRootUser()

        await adminRegistrationPage.navigateToRegistrationsList()
        await adminRegistrationPage.accept('user_4', 'moderation response 2')

        await loginPage.logout()
      })

      it('Should validate the email', async function () {
        const email = await waitEmailTo(emails, 'user_4@example.com', '/verify-account/')

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

      it('Should propose to log in in the app on the login page', async function () {
        await withMobileBrowser(ANDROID_USER_AGENT, async () => {
          await go('/login')

          expect(await signupPage.getMobileAppMessage()).toBe('Log in in the application?')
          expect(await signupPage.getMobileAppLink()).toContain(`intent://joinpeertube.org/login-redirect?host=${getHost()}#Intent;`)
        })
      })
    })

    describe('Direct registration from the mobile app', function () {
      it('Should enable signup without approval', async () => {
        await prepareSignup({ enabled: true, requiresApproval: false, requiresEmailVerification: true })
      })

      it('Should register from the app', async function () {
        await registerFromApp({ username: 'user_5', password: 'superpassword' })
      })

      it('Should validate the email on Android and propose to log in in the app', async function () {
        const email = await waitEmailTo(emails, 'user_5@example.com')

        await withMobileBrowser(ANDROID_USER_AGENT, async () => {
          await go(getVerificationLink(email))

          checkEndMessage({
            message: await signupPage.getEndMessage(),
            requiresEmailVerification: false,
            requiresApproval: false,
            afterEmailVerification: true
          })

          const button = await signupPage.getEndMessageButton()
          expect(button.text).toBe('Log in in the app')
          expect(button.href).toContain(`intent://joinpeertube.org/signup-verified?host=${getHost()}&username=user_5`)
          expect(button.href).toContain('#Intent;scheme=peertube;S.browser_fallback_url=https://play.google.com/')

          expect(await signupPage.getMobileAppMessage()).toBe('Open in the application?')

          await browser.saveScreenshot(getScreenshotPath('app-direct-after-email.png'))
        })
      })
    })

    describe('Registration with approval from the mobile app', function () {
      it('Should enable signup with approval', async () => {
        await prepareSignup({ enabled: true, requiresApproval: true, requiresEmailVerification: true })
      })

      it('Should request a registration from the app', async function () {
        await registerFromApp({ username: 'user_6', password: 'superpassword', registrationReason: 'my app reason' })
      })

      it('Should validate the email without proposing to log in in the app', async function () {
        const email = await waitEmailTo(emails, 'user_6@example.com', '/verify-account/')

        await withMobileBrowser(ANDROID_USER_AGENT, async () => {
          await go(getVerificationLink(email))

          checkEndMessage({
            message: await signupPage.getEndMessage(),
            requiresEmailVerification: false,
            requiresApproval: true,
            afterEmailVerification: true
          })

          // The account does not exist yet: the accepted email will redirect the user on the login page
          expect(await signupPage.getMobileAppMessage()).toBe('Open in the application?')
        })
      })

      it('Should accept the registration', async function () {
        await loginPage.loginAsRootUser()

        await adminRegistrationPage.navigateToRegistrationsList()
        await adminRegistrationPage.accept('user_6', 'moderation response app', { preventEmailDelivery: false })

        await loginPage.logout()
      })

      it('Should propose to log in in the app on iPhone', async function () {
        const email = await waitEmailTo(emails, 'user_6@example.com', '/login')

        await withMobileBrowser(IPHONE_USER_AGENT, async () => {
          await go(getLoginLink(email))

          expect(await signupPage.getMobileAppMessage()).toBe('Log in in the application?')
          expect(await signupPage.getMobileAppLink()).toBe(`peertube://joinpeertube.org/login-redirect?host=${getHost()}&username=user_6`)

          await browser.saveScreenshot(getScreenshotPath('app-request-accepted-login.png'))
        })
      })

      it('Should log in on the web with the prefilled username', async function () {
        const email = await waitEmailTo(emails, 'user_6@example.com', '/login')

        await go(getLoginLink(email))

        expect(await loginPage.getUsernameValue()).toBe('user_6')
        expect(await $('.mobile-msg').isExisting()).toBe(false)

        await loginPage.loginWithPrefilledUsername({ password: 'superpassword', displayName: 'user_6 display name' })

        await loginPage.logout()
      })
    })

    after(() => {
      MockSMTPServer.Instance.kill()
    })
  })

  after(async () => {
    await browser.saveScreenshot(getScreenshotPath('after-test.png'))
  })
})
