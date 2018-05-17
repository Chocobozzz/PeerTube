import { VideoWatchPage } from './po/video-watch.po'
import { VideoUploadPage } from './po/video-upload.po'
import { LoginPage } from './po/login.po'
import { browser } from 'protractor'

describe('Videos workflow', () => {
  let videoWatchPage: VideoWatchPage
  let pageUploadPage: VideoUploadPage
  let loginPage: LoginPage
  const videoName = new Date().getTime() + ' video'

  beforeEach(() => {
    videoWatchPage = new VideoWatchPage()
    pageUploadPage = new VideoUploadPage()
    loginPage = new LoginPage()
  })

  it('Should log in', () => {
    return loginPage.loginAsRootUser()
  })

  it('Should upload a video', async () => {
    pageUploadPage.navigateTo()

    await pageUploadPage.uploadVideo()
    return pageUploadPage.validSecondUploadStep(videoName)
  })

  it('Should list the video', async () => {
    await videoWatchPage.goOnRecentlyAdded()

    const videoNames = videoWatchPage.getVideosListName()
    expect(videoNames).toContain(videoName)
  })

  it('Should go on video watch page', async () => {
    await videoWatchPage.clickOnFirstVideoOfList()

    return videoWatchPage.waitWatchVideoName(videoName)
  })

  it('Should play the video', async () => {
    await browser.sleep(4000)

    await videoWatchPage.pauseVideo()
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })
})
