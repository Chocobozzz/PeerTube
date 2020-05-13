import { browser } from 'protractor'
import { AppPage } from './po/app.po'
import { LoginPage } from './po/login.po'
import { MyAccountPage } from './po/my-account'
import { VideoUpdatePage } from './po/video-update.po'
import { VideoUploadPage } from './po/video-upload.po'
import { VideoWatchPage } from './po/video-watch.po'
import { isIOS, isMobileDevice, isSafari } from './utils'

async function skipIfUploadNotSupported () {
  if (await isMobileDevice() || await isSafari()) {
    console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
    return true
  }

  return false
}

describe('Videos workflow', () => {
  let videoWatchPage: VideoWatchPage
  let videoUploadPage: VideoUploadPage
  let videoUpdatePage: VideoUpdatePage
  let myAccountPage: MyAccountPage
  let loginPage: LoginPage
  let appPage: AppPage

  let videoName = new Date().getTime() + ' video'
  const video2Name = new Date().getTime() + ' second video'
  const playlistName = new Date().getTime() + ' playlist'
  let videoWatchUrl: string

  beforeEach(async () => {
    videoWatchPage = new VideoWatchPage()
    videoUploadPage = new VideoUploadPage()
    videoUpdatePage = new VideoUpdatePage()
    myAccountPage = new MyAccountPage()
    loginPage = new LoginPage()
    appPage = new AppPage()

    if (await isIOS()) {
      // iOS does not seem to work with protractor
      // https://github.com/angular/protractor/issues/2840
      browser.ignoreSynchronization = true

      console.log('iOS detected')
    } else if (await isMobileDevice()) {
      console.log('Android detected.')
    } else if (await isSafari()) {
      console.log('Safari detected.')
    }

    if (!await isMobileDevice()) {
      await browser.driver.manage().window().maximize()
    }
  })

  it('Should log in', async () => {
    if (await isMobileDevice() || await isSafari()) {
      console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
      return
    }

    return loginPage.loginAsRootUser()
  })

  it('Should close the welcome modal', async () => {
    if (await skipIfUploadNotSupported()) return

    await appPage.closeWelcomeModal()
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

    await videoWatchPage.playAndPauseVideo(true)
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })

  it('Should watch the associated embed video', async () => {
    await browser.waitForAngularEnabled(false)

    await videoWatchPage.goOnAssociatedEmbed()

    await videoWatchPage.playAndPauseVideo(false)
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)

    await browser.waitForAngularEnabled(true)
  })

  it('Should watch the p2p media loader embed video', async () => {
    await browser.waitForAngularEnabled(false)

    await videoWatchPage.goOnP2PMediaLoaderEmbed()

    await videoWatchPage.playAndPauseVideo(false)
    expect(videoWatchPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)

    await browser.waitForAngularEnabled(true)
  })

  it('Should update the video', async () => {
    if (await skipIfUploadNotSupported()) return

    await browser.get(videoWatchUrl)

    await videoWatchPage.clickOnUpdate()

    videoName += ' updated'
    await videoUpdatePage.updateName(videoName)

    await videoUpdatePage.validUpdate()

    const name = await videoWatchPage.getVideoName()
    expect(name).toEqual(videoName)
  })

  it('Should add the video in my playlist', async () => {
    if (await skipIfUploadNotSupported()) return

    await videoWatchPage.clickOnSave()

    await videoWatchPage.createPlaylist(playlistName)

    await videoWatchPage.saveToPlaylist(playlistName)

    await videoUploadPage.navigateTo()

    await videoUploadPage.uploadVideo()
    await videoUploadPage.validSecondUploadStep(video2Name)

    await videoWatchPage.clickOnSave()
    await videoWatchPage.saveToPlaylist(playlistName)
  })

  it('Should have the playlist in my account', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.navigateToMyPlaylists()

    const videosNumberText = await myAccountPage.getPlaylistVideosText(playlistName)
    expect(videosNumberText).toEqual('2 videos')

    await myAccountPage.clickOnPlaylist(playlistName)

    const count = await myAccountPage.countTotalPlaylistElements()
    expect(count).toEqual(2)
  })

  it('Should watch the playlist', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.playPlaylist()

    await videoWatchPage.waitUntilVideoName(video2Name, 20000 * 1000)
  })

  it('Should delete the video 2', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.navigateToMyVideos()

    await myAccountPage.removeVideo(video2Name)
    await myAccountPage.validRemove()

    const count = await myAccountPage.countVideos([ videoName, video2Name ])
    expect(count).toEqual(1)
  })

  it('Should delete the first video', async () => {
    if (await skipIfUploadNotSupported()) return

    await myAccountPage.removeVideo(videoName)
    await myAccountPage.validRemove()
  })
})
