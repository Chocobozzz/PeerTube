import { VideoWatchPage } from './po/video-watch.po'
import { VideoUploadPage } from './po/video-upload.po'
import { LoginPage } from './po/login.po'
import { browser } from 'protractor'
import { VideoUpdatePage } from './po/video-update.po'
import { MyAccountPage } from './po/my-account'

async function skipIfUploadNotSupported () {
  if (await isMobileDevice() || await isSafari()) {
    console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
    return true
  }

  return false
}

async function isMobileDevice () {
  const caps = await browser.getCapabilities()
  return caps.get('realMobile') === 'true' || caps.get('realMobile') === true
}

async function isSafari () {
  const caps = await browser.getCapabilities()
  return caps.get('browserName') && caps.get('browserName').toLowerCase() === 'safari'
}

describe('Videos workflow', () => {
  let videoWatchPage: VideoWatchPage
  let videoUploadPage: VideoUploadPage
  let videoUpdatePage: VideoUpdatePage
  let myAccountPage: MyAccountPage
  let loginPage: LoginPage

  const videoName = new Date().getTime() + ' video'
  let videoWatchUrl: string

  beforeEach(async () => {
    videoWatchPage = new VideoWatchPage()
    videoUploadPage = new VideoUploadPage()
    videoUpdatePage = new VideoUpdatePage()
    myAccountPage = new MyAccountPage()
    loginPage = new LoginPage()

    if (await isMobileDevice()) {
      console.log('Mobile device detected.')
    }

    if (await isSafari()) {
      console.log('Safari detected.')
    }
  })

  it('Should log in', async () => {
    if (await isMobileDevice() || await isSafari()) {
      console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
      return
    }

    return loginPage.loginAsRootUser()
  })

  it('Should upload a video', async () => {
    if (await skipIfUploadNotSupported()) return

    await videoUploadPage.navigateTo()

    await videoUploadPage.uploadVideo()
    return videoUploadPage.validSecondUploadStep(videoName)
  })

  it('Should list videos', async () => {
    await videoWatchPage.goOnVideosList(await isMobileDevice(), await isSafari())

    if (await skipIfUploadNotSupported()) return

    const videoNames = videoWatchPage.getVideosListName()
    expect(videoNames).toContain(videoName)
  })

  it('Should go on video watch page', async () => {
    let videoNameToExcept = videoName

    if (await isMobileDevice() || await isSafari()) videoNameToExcept = await videoWatchPage.clickOnFirstVideo()
    else await videoWatchPage.clickOnVideo(videoName)

    return videoWatchPage.waitWatchVideoName(videoNameToExcept, await isMobileDevice(), await isSafari())
  })

  it('Should play the video', async () => {
    videoWatchUrl = await browser.getCurrentUrl()

    await videoWatchPage.playAndPauseVideo(true, await isMobileDevice())
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })

  it('Should watch the associated embed video', async () => {
    await browser.waitForAngularEnabled(false)

    await videoWatchPage.goOnAssociatedEmbed()

    await videoWatchPage.playAndPauseVideo(false, await isMobileDevice())
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)

    await browser.waitForAngularEnabled(true)
  })

  it('Should watch the p2p media loader embed video', async () => {
    await browser.waitForAngularEnabled(false)

    await videoWatchPage.goOnP2PMediaLoaderEmbed()

    await videoWatchPage.playAndPauseVideo(false, await isMobileDevice())
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)

    await browser.waitForAngularEnabled(true)
  })

  it('Should update the video', async () => {
    if (await skipIfUploadNotSupported()) return

    await browser.get(videoWatchUrl)

    await videoWatchPage.clickOnUpdate()

    await videoUpdatePage.updateName('my new name')

    await videoUpdatePage.validUpdate()

    const name = await videoWatchPage.getVideoName()
    expect(name).toEqual('my new name')
  })

  it('Should add the video in my playlist', async () => {
    if (await skipIfUploadNotSupported()) return

    await videoWatchPage.clickOnSave()
    await videoWatchPage.saveToWatchLater()

    await videoUploadPage.navigateTo()

    await videoUploadPage.uploadVideo()
    await videoUploadPage.validSecondUploadStep('second video')

    await videoWatchPage.clickOnSave()
    await videoWatchPage.saveToWatchLater()
  })

  it('Should have the watch later playlist in my account', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.navigateToMyPlaylists()

    const name = await myAccountPage.getLastUpdatedPlaylistName()
    expect(name).toEqual('Watch later')

    const videosNumberText = await myAccountPage.getLastUpdatedPlaylistVideosText()
    expect(videosNumberText).toEqual('2 videos')

    await myAccountPage.clickOnLastUpdatedPlaylist()

    const count = await myAccountPage.countTotalPlaylistElements()
    expect(count).toEqual(2)
  })

  it('Should watch the playlist', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.playPlaylist()

    await videoWatchPage.waitUntilVideoName('second video', 20000 * 1000)
  })

  it('Should have the video in my account', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.navigateToMyVideos()

    const lastVideoName = await myAccountPage.getLastVideoName()
    expect(lastVideoName).toEqual('second video')
  })

  it('Should delete the last video', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.removeLastVideo()
    await myAccountPage.validRemove()

    const count = await myAccountPage.countVideos()
    expect(count).toEqual(1)
  })

  it('Should delete the first video', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.removeLastVideo()
    await myAccountPage.validRemove()

    const count = await myAccountPage.countVideos()
    expect(count).toEqual(0)
  })
})
