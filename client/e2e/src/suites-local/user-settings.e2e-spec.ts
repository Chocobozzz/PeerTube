import { AdminConfigPage } from '../po/admin-config.po'
import { AdminUserPage } from '../po/admin-user.po'
import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import { browserSleep, findEmailTo, getEmailPort, getVerificationLink, go, MockSMTPServer, prepareWebBrowser, waitServerUp } from '../utils'

describe('User settings', () => {
  let loginPage: LoginPage
  let myAccountPage: MyAccountPage
  let adminConfigPage: AdminConfigPage
  let adminUserPage: AdminUserPage

  const emails: any[] = []

  const seed = Math.random().toString().slice(2, 10)
  const username = 'user_' + seed
  const password = 'superpassword'

  async function checkCurrentEmail (email: string) {
    await myAccountPage.navigateToMySettings()

    const changeEmailBlock = $('.change-email .form-group-description')
    await changeEmailBlock.waitForDisplayed()
    await expect(changeEmailBlock).toHaveText(expect.stringContaining('Your current email is ' + email))
  }

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage()
    myAccountPage = new MyAccountPage()
    adminConfigPage = new AdminConfigPage()
    adminUserPage = new AdminUserPage()

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

    it('Should directly change the email of an administrator', async function () {
      await myAccountPage.navigateToMySettings()
      await myAccountPage.updateEmail('admin2@example.com', loginPage.getRootPassword())

      const alertBlock = $('my-account-change-email .alert-success')
      await alertBlock.waitForDisplayed()
      await expect(alertBlock).toHaveText(expect.stringContaining('Email updated'))

      await checkCurrentEmail('admin2@example.com')
    })

    it('Should ask a regular user to verify the new email', async function () {
      await adminUserPage.createUser({ username, password })
      await loginPage.logout()

      await loginPage.login({ username, password })

      await myAccountPage.navigateToMySettings()
      await myAccountPage.updateEmail('email2@example.com', password)

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

      await checkCurrentEmail('email2@example.com')
    })
  })

  after(() => {
    MockSMTPServer.Instance.kill()
  })
})
