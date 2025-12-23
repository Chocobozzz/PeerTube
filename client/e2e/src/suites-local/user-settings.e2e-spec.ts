import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import {
  browserSleep,
  findEmailTo,
  getEmailPort,
  getVerificationLink,
  go,
  isMobileDevice,
  MockSMTPServer,
  prepareWebBrowser,
  waitServerUp
} from '../utils'

describe('User settings', () => {
  let loginPage: LoginPage
  let myAccountPage: MyAccountPage
  let adminConfigPage: AdminConfigPage

  const emails: any[] = []

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    myAccountPage = new MyAccountPage()
    adminConfigPage = new AdminConfigPage()

    await MockSMTPServer.Instance.collectEmails(await getEmailPort(), emails)

    await prepareWebBrowser()
  })

  describe('Email', function () {
    before(async function () {
      await loginPage.loginAsRootUser()

      await adminConfigPage.toggleSignup(true)
      await adminConfigPage.toggleSignupEmailVerification(true)
      await adminConfigPage.save()

      await browser.refresh()
    })

    it('Should ask to change the email', async function () {
      await myAccountPage.navigateToMySettings()
      await myAccountPage.updateEmail('email2@example.com', loginPage.getRootPassword())

      const pendingEmailBlock = $('.pending-email')
      await pendingEmailBlock.waitForDisplayed()
      await expect(pendingEmailBlock).toHaveText(expect.stringContaining('email2@example.com is awaiting email verification'))

      let email: { text: string }

      while (!(email = findEmailTo(emails, 'email2@example.com'))) {
        await browserSleep(100)
      }

      await go(getVerificationLink(email))

      const alertBlock = $('.alert-success')
      await alertBlock.waitForDisplayed()
      await expect(alertBlock).toHaveText(expect.stringContaining('Email updated'))

      await myAccountPage.navigateToMySettings()
      const changeEmailBlock = $('.change-email .form-group-description')
      await changeEmailBlock.waitForDisplayed()
      await expect(changeEmailBlock).toHaveText(expect.stringContaining('Your current email is email2@example.com'))
    })
  })

  after(() => {
    MockSMTPServer.Instance.kill()
  })
})
