import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { go, isMobileDevice, isSafari, prepareWebBrowser, waitServerUp } from '../utils'

describe('Custom server defaults', () => {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await prepareWebBrowser({ hidePrivacyConcerns: false })
  })

  describe('Publish default values', function () {
    before(async function () {
      await loginPage.loginAsRootUser()
    })

    it('Should upload a video with custom default values', async function () {
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video.mp4')
      await videoPublishPage.validSecondStep('video')

      await videoPublishPage.clickOnWatch()
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
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video2.mp4')
      await videoPublishPage.setAsPublic()
      await videoPublishPage.validSecondStep('video')

      await videoPublishPage.clickOnWatch()
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
})
