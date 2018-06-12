import { VideoWatchPage } from './po/video-watch.po'
import { VideoUploadPage } from './po/video-upload.po'
import { LoginPage } from './po/login.po'
import { browser } from 'protractor'

describe('Videos workflow', () => {
  let videoWatchPage: VideoWatchPage
  let pageUploadPage: VideoUploadPage
  let loginPage: LoginPage
  const videoName = new Date().getTime() + ' video'
  let isMobileDevice = false
  let isSafari = false

  beforeEach(async () => {
    browser.waitForAngularEnabled(false)

    videoWatchPage = new VideoWatchPage()
    pageUploadPage = new VideoUploadPage()
    loginPage = new LoginPage()

    const caps = await browser.getCapabilities()
    isMobileDevice = caps.get('realMobile') === 'true' || caps.get('realMobile') === true
    isSafari = caps.get('browserName') && caps.get('browserName').toLowerCase() === 'safari'
  })

  it('Should log in', () => {
    if (isMobileDevice || isSafari) {
      console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
      return
    }

    return loginPage.loginAsRootUser()
  })

  it('Should upload a video', async () => {
    if (isMobileDevice || isSafari) {
      console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
      return
    }

    await pageUploadPage.navigateTo()

    await pageUploadPage.uploadVideo()
    return pageUploadPage.validSecondUploadStep(videoName)
  })

  it('Should list the video', async () => {
    await videoWatchPage.goOnVideosList(isMobileDevice, isSafari)

    if (isMobileDevice || isSafari) {
      console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
      return
    }

    const videoNames = videoWatchPage.getVideosListName()
    expect(videoNames).toContain(videoName)
  })

  it('Should go on video watch page', async () => {
    let videoNameToExcept = videoName

    if (isMobileDevice || isSafari) videoNameToExcept = await videoWatchPage.clickOnFirstVideo()
    else await videoWatchPage.clickOnVideo(videoName)

    return videoWatchPage.waitWatchVideoName(videoNameToExcept, isSafari)
  })

  it('Should play the video', async () => {
    await videoWatchPage.pauseVideo(!isMobileDevice, isMobileDevice)
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })

  it('Should watch the associated embed video', async () => {
    await videoWatchPage.goOnAssociatedEmbed()

    await videoWatchPage.pauseVideo(false, isMobileDevice)
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })
})
