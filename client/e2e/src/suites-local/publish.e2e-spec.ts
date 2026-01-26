import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { isMobileDevice, isSafari, prepareWebBrowser, waitServerUp } from '../utils'

describe('Publish video', () => {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await prepareWebBrowser()

    await loginPage.loginAsRootUser()
  })

  describe('Default upload values', function () {
    it('Should have default video values', async function () {
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video3.mp4')
      await videoPublishPage.validSecondStep('video')

      await videoPublishPage.clickOnWatch()
      await videoWatchPage.waitWatchVideoName('video')

      expect(await videoWatchPage.getPrivacy()).toBe('Public')
      expect(await videoWatchPage.getLicence()).toBe('Unknown')
      expect(await videoWatchPage.isDownloadEnabled()).toBeTruthy()
      expect(await videoWatchPage.areCommentsEnabled()).toBeTruthy()
    })
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

      expect(videoPublishPage.getScheduleInput()).toBeDisplayed()

      const nextDay = new Date()
      nextDay.setDate(1)
      nextDay.setMonth(nextDay.getMonth() + 1)

      const inputDate = new Date(await videoPublishPage.getScheduleInput().getValue())
      expect(inputDate.getDate()).toEqual(nextDay.getDate())
      expect(inputDate.getMonth()).toEqual(nextDay.getMonth())
      expect(inputDate.getFullYear()).toEqual(nextDay.getFullYear())
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
})
