import { AnonymousSettingsPage } from '../po/anonymous-settings.po'
import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { go, isMobileDevice, isSafari, waitServerUp } from '../utils'

describe('User settings', () => {
  let videoUploadPage: VideoUploadPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage
  let myAccountPage: MyAccountPage
  let anonymousSettingsPage: AnonymousSettingsPage

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoUploadPage = new VideoUploadPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())
    myAccountPage = new MyAccountPage()
    anonymousSettingsPage = new AnonymousSettingsPage()

    await browser.maximizeWindow()
  })

  describe('P2P', function () {
    let videoUrl: string

    async function goOnVideoWatchPage () {
      await go(videoUrl)
      await videoWatchPage.waitWatchVideoName('video')
    }

    async function checkP2P (enabled: boolean) {
      await goOnVideoWatchPage()
      expect(await videoWatchPage.isPrivacyWarningDisplayed()).toEqual(enabled)

      await videoWatchPage.goOnAssociatedEmbed()
      expect(await videoWatchPage.isEmbedWarningDisplayed()).toEqual(enabled)
    }

    before(async () => {
      await loginPage.loginAsRootUser()
      await videoUploadPage.navigateTo()
      await videoUploadPage.uploadVideo('video.mp4')
      await videoUploadPage.validSecondUploadStep('video')

      await videoWatchPage.waitWatchVideoName('video')

      videoUrl = await browser.getUrl()
    })

    beforeEach(async function () {
      await goOnVideoWatchPage()
    })

    it('Should have P2P enabled for a logged in user', async function () {
      await checkP2P(true)
    })

    it('Should disable P2P for a logged in user', async function () {
      await myAccountPage.navigateToMySettings()
      await myAccountPage.clickOnP2PCheckbox()

      await checkP2P(false)
    })

    it('Should have P2P enabled for anonymous users', async function () {
      await loginPage.logout()

      await checkP2P(true)
    })

    it('Should disable P2P for an anonymous user', async function () {
      await anonymousSettingsPage.openSettings()
      await anonymousSettingsPage.clickOnP2PCheckbox()

      await checkP2P(false)
    })
  })
})
