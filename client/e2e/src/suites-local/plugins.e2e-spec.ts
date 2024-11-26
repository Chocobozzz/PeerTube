import { AdminPluginPage } from '../po/admin-plugin.po'
import { LoginPage } from '../po/login.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { getCheckbox, isMobileDevice, waitServerUp } from '../utils'

describe('Plugins', () => {
  let videoUploadPage: VideoUploadPage
  let loginPage: LoginPage
  let adminPluginPage: AdminPluginPage

  function getPluginCheckbox () {
    return getCheckbox('hello-world-field-4')
  }

  async function expectSubmitState ({ disabled }: { disabled: boolean }) {
    const disabledSubmit = await $('my-button [disabled]')

    if (disabled) expect(await disabledSubmit.isDisplayed()).toBeTruthy()
    else expect(await disabledSubmit.isDisplayed()).toBeFalsy()
  }

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    loginPage = new LoginPage(isMobileDevice())
    videoUploadPage = new VideoUploadPage()
    adminPluginPage = new AdminPluginPage()

    await browser.maximizeWindow()
  })

  it('Should install hello world plugin', async () => {
    await loginPage.loginAsRootUser()

    await adminPluginPage.navigateToPluginSearch()
    await adminPluginPage.search('hello-world')
    await adminPluginPage.installHelloWorld()
    await browser.refresh()
  })

  it('Should have checkbox in video edit page', async () => {
    await videoUploadPage.navigateTo()
    await videoUploadPage.uploadVideo('video.mp4')

    await $('span=Super field 4 in main tab').waitForDisplayed()

    const checkbox = await getPluginCheckbox()
    expect(await checkbox.isDisplayed()).toBeTruthy()

    await expectSubmitState({ disabled: true })
  })

  it('Should check the checkbox and be able to submit the video', async function () {
    const checkbox = await getPluginCheckbox()

    await checkbox.waitForClickable()
    await checkbox.click()

    await expectSubmitState({ disabled: false })
  })

  it('Should uncheck the checkbox and not be able to submit the video', async function () {
    const checkbox = await getPluginCheckbox()

    await checkbox.waitForClickable()
    await checkbox.click()

    await expectSubmitState({ disabled: true })

    const error = await $('.form-error*=Should be enabled')

    expect(await error.isDisplayed()).toBeTruthy()
  })

  it('Should change the privacy and should hide the checkbox', async function () {
    await videoUploadPage.setAsPrivate()

    await expectSubmitState({ disabled: false })
  })
})
