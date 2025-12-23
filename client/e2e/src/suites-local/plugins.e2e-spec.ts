import { AdminPluginPage } from '../po/admin-plugin.po'
import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { getCheckbox, isMobileDevice, prepareWebBrowser, waitServerUp } from '../utils'

describe('Plugins', () => {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage
  let adminPluginPage: AdminPluginPage

  function getPluginCheckbox () {
    return getCheckbox('hello-world-field-4')
  }

  async function expectSubmitError (hasError: boolean) {
    await videoPublishPage.clickOnSave()

    await $('.form-error*=Should be enabled').waitForDisplayed({ reverse: !hasError })
    await $('li*=Should be enabled').waitForDisplayed({ reverse: !hasError })
  }

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()
    adminPluginPage = new AdminPluginPage()

    await prepareWebBrowser()
  })

  it('Should install hello world plugin', async () => {
    await loginPage.loginAsRootUser()

    await adminPluginPage.navigateToPluginSearch()
    await adminPluginPage.search('hello-world')
    await adminPluginPage.installHelloWorld()
    await browser.refresh()
  })

  it('Should have checkbox in video edit page', async () => {
    await videoPublishPage.navigateTo()
    await videoPublishPage.uploadVideo('video.mp4')

    const el = () => $('span=Super field 4 in main tab')
    await el().waitForDisplayed()

    // Only displayed if the video is public
    await videoPublishPage.setAsPrivate()
    await el().waitForDisplayed({ reverse: true })

    await videoPublishPage.setAsPublic()
    await el().waitForDisplayed()

    const checkbox = await getPluginCheckbox()
    expect(await checkbox.isDisplayed()).toBeTruthy()

    await expectSubmitError(true)
  })

  it('Should check the checkbox and be able to submit the video', async function () {
    const checkbox = await getPluginCheckbox()

    await checkbox.waitForClickable()
    await checkbox.click()

    await expectSubmitError(false)
  })

  it('Should uncheck the checkbox and not be able to submit the video', async function () {
    const checkbox = await getPluginCheckbox()

    await checkbox.waitForClickable()
    await checkbox.click()

    await expectSubmitError(true)
  })

  it('Should change the privacy and should hide the checkbox', async function () {
    await videoPublishPage.setAsPrivate()

    await expectSubmitError(false)
  })
})
