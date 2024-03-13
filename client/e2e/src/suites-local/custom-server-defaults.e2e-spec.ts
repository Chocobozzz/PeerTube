import { LoginPage } from '../po/login.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { getScreenshotPath, go, isMobileDevice, isSafari, waitServerUp } from '../utils'

describe('Custom server defaults', () => {
  let videoUploadPage: VideoUploadPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoUploadPage = new VideoUploadPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await browser.maximizeWindow()
  })

  describe('Publish default values', function () {
    before(async function () {
      await loginPage.loginAsRootUser()
    })

    it('Should upload a video with custom default values', async function () {
      await videoUploadPage.navigateTo()
      await videoUploadPage.uploadVideo('video.mp4')
      await videoUploadPage.validSecondUploadStep('video')

      await videoWatchPage.waitWatchVideoName('video')

      const videoUrl = await browser.getUrl()

      expect(await videoWatchPage.getPrivacy()).toBe('Unlisted')
      expect(await videoWatchPage.getLicence()).toBe('Attribution - Non Commercial')
      expect(await videoWatchPage.areCommentsEnabled()).toBeFalsy()

      // Owners can download their videos
      expect(await videoWatchPage.isDownloadEnabled()).toBeTruthy()

      // Logout to see if the download enabled is correct for anonymous users
      await loginPage.logout()
      await browser.url(videoUrl)
      await videoWatchPage.waitWatchVideoName('video')

      expect(await videoWatchPage.isDownloadEnabled()).toBeFalsy()
    })
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
      await videoUploadPage.uploadVideo('video2.mp4')
      await videoUploadPage.setAsPublic()
      await videoUploadPage.validSecondUploadStep('video')

      await videoWatchPage.waitWatchVideoName('video')

      videoUrl = await browser.getUrl()
    })

    beforeEach(async function () {
      await goOnVideoWatchPage()
    })

    it('Should have P2P disabled for a logged in user', async function () {
      await checkP2P(false)
    })

    it('Should have P2P disabled for anonymous users', async function () {
      await loginPage.logout()

      await checkP2P(false)
    })
  })

  after(async () => {
    await browser.saveScreenshot(getScreenshotPath('after-test.png'))
  })
})
