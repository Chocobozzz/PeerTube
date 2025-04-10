import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { getScreenshotPath, isMobileDevice, waitServerUp } from '../utils'

describe('Publish video', () => {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()

    await browser.maximizeWindow()

    await loginPage.loginAsRootUser()
  })

  describe('Common', function () {
    it('Should upload a video and on refresh being redirected to the manage page', async function () {
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video.mp4')
      await videoPublishPage.validSecondStep('first video')

      await videoPublishPage.refresh('first video')
    })

    it('Should upload a video and schedule upload date', async function () {
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video.mp4')

      await videoPublishPage.scheduleUpload()
      await videoPublishPage.validSecondStep('scheduled')

      await videoPublishPage.refresh('scheduled')

      // check if works? screenshot
      expect(videoPublishPage.getScheduleInput()).toBeDisplayed()

      const nextDay = new Date()
      nextDay.setDate(nextDay.getDate() + 1)

      const inputDate = new Date(await videoPublishPage.getScheduleInput().getValue())
      expect(nextDay.getDate()).toEqual(inputDate.getDate())
      expect(nextDay.getMonth()).toEqual(inputDate.getMonth())
      expect(nextDay.getFullYear()).toEqual(inputDate.getFullYear())
    })
  })

  describe('Import', function () {
    it('Should import a video and on refresh being redirected to the manage page', async function () {
      await videoPublishPage.navigateTo()
      await videoPublishPage.importVideo()
      await videoPublishPage.validSecondStep('second video')

      await videoPublishPage.refresh('second video')
    })
  })

  after(async () => {
    await browser.saveScreenshot(getScreenshotPath('after-test.png'))
  })
})
