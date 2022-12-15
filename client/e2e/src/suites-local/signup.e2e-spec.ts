import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { SignupPage } from '../po/signup.po'
import { isMobileDevice, waitServerUp } from '../utils'

describe('Signup', () => {
  let loginPage: LoginPage
  let adminConfigPage: AdminConfigPage
  let signupPage: SignupPage

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    loginPage = new LoginPage(isMobileDevice())
    adminConfigPage = new AdminConfigPage()
    signupPage = new SignupPage()

    await browser.maximizeWindow()
  })

  it('Should disable signup', async () => {
    await loginPage.loginAsRootUser()

    await adminConfigPage.navigateTo('basic-configuration')
    await adminConfigPage.toggleSignup()

    await adminConfigPage.save()

    await loginPage.logout()
    await browser.refresh()

    expect(signupPage.getRegisterMenuButton()).not.toBeDisplayed()
  })

  it('Should enable signup', async () => {
    await loginPage.loginAsRootUser()

    await adminConfigPage.navigateTo('basic-configuration')
    await adminConfigPage.toggleSignup()

    await adminConfigPage.save()

    await loginPage.logout()
    await browser.refresh()

    expect(signupPage.getRegisterMenuButton()).toBeDisplayed()
  })

  it('Should go on signup page', async function () {
    await signupPage.clickOnRegisterInMenu()
  })

  it('Should validate the first step (about page)', async function () {
    await signupPage.validateStep()
  })

  it('Should validate the second step (terms)', async function () {
    await signupPage.checkTerms()
    await signupPage.validateStep()
  })

  it('Should validate the third step (account)', async function () {
    await signupPage.fillAccountStep({
      displayName: 'user 1',
      username: 'user_1',
      email: 'user_1@example.com',
      password: 'my_super_password'
    })

    await signupPage.validateStep()
  })

  it('Should validate the third step (channel)', async function () {
    await signupPage.fillChannelStep({
      displayName: 'user 1 channel',
      name: 'user_1_channel'
    })

    await signupPage.validateStep()
  })

  it('Should be logged in', async function () {
    await loginPage.ensureIsLoggedInAs('user 1')
  })
})
