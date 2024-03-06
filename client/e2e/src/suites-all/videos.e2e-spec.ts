import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import { PlayerPage } from '../po/player.po'
import { VideoListPage } from '../po/video-list.po'
import { VideoUpdatePage } from '../po/video-update.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { FIXTURE_URLS, go, isIOS, isMobileDevice, isSafari, waitServerUp } from '../utils'

function isUploadUnsupported () {
  if (isMobileDevice() || isSafari()) {
    console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
    return true
  }

  return false
}

describe('Videos all workflow', () => {
  let videoWatchPage: VideoWatchPage
  let videoListPage: VideoListPage
  let videoUploadPage: VideoUploadPage
  let videoUpdatePage: VideoUpdatePage
  let myAccountPage: MyAccountPage
  let loginPage: LoginPage
  let playerPage: PlayerPage

  let videoName = Math.random() + ' video'
  const video2Name = Math.random() + ' second video'
  const playlistName = Math.random() + ' playlist'
  let videoWatchUrl: string

  before(async () => {
    if (isIOS()) {
      console.log('iOS detected')
    } else if (isMobileDevice()) {
      console.log('Android detected.')
    } else if (isSafari()) {
      console.log('Safari detected.')
    }

    if (isUploadUnsupported()) return

    await waitServerUp()
  })

  beforeEach(async () => {
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())
    videoUploadPage = new VideoUploadPage()
    videoUpdatePage = new VideoUpdatePage()
    myAccountPage = new MyAccountPage()
    loginPage = new LoginPage(isMobileDevice())
    playerPage = new PlayerPage()
    videoListPage = new VideoListPage(isMobileDevice(), isSafari())

    if (!isMobileDevice()) {
      await browser.maximizeWindow()
    }
  })

  it('Should log in', async () => {
    if (isMobileDevice() || isSafari()) {
      console.log('Skipping because we are on a real device or Safari and BrowserStack does not support file upload.')
      return
    }

    return loginPage.loginAsRootUser()
  })

  it('Should upload a video', async () => {
    if (isUploadUnsupported()) return

    await videoUploadPage.navigateTo()

    await videoUploadPage.uploadVideo('video.mp4')
    return videoUploadPage.validSecondUploadStep(videoName)
  })

  it('Should list videos', async () => {
    await videoListPage.goOnVideosList()

    if (isUploadUnsupported()) return

    const videoNames = await videoListPage.getVideosListName()
    expect(videoNames).toContain(videoName)
  })

  it('Should go on video watch page', async () => {
    let videoNameToExcept = videoName

    if (isMobileDevice() || isSafari()) {
      await go(FIXTURE_URLS.WEB_VIDEO)
      videoNameToExcept = 'E2E tests'
    } else {
      await videoListPage.clickOnVideo(videoName)
    }

    return videoWatchPage.waitWatchVideoName(videoNameToExcept)
  })

  it('Should play the video', async () => {
    videoWatchUrl = await browser.getUrl()

    await playerPage.playAndPauseVideo(true, 2)
    expect(await playerPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })

  it('Should watch the associated embed video', async () => {
    await videoWatchPage.goOnAssociatedEmbed()

    await playerPage.playAndPauseVideo(false, 2)
    expect(await playerPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })

  it('Should watch the p2p media loader embed video', async () => {
    await videoWatchPage.goOnP2PMediaLoaderEmbed()

    await playerPage.playAndPauseVideo(false, 2)
    expect(await playerPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
  })

  it('Should update the video', async () => {
    if (isUploadUnsupported()) return

    await go(videoWatchUrl)

    await videoWatchPage.clickOnUpdate()

    videoName += ' updated'
    await videoUpdatePage.updateName(videoName)

    await videoUpdatePage.validUpdate()

    const name = await videoWatchPage.getVideoName()
    expect(name).toEqual(videoName)
  })

  it('Should add the video in my playlist', async () => {
    if (isUploadUnsupported()) return

    await videoWatchPage.clickOnSave()

    await videoWatchPage.createPlaylist(playlistName)

    await videoWatchPage.saveToPlaylist(playlistName)
    await browser.pause(5000)

    await videoUploadPage.navigateTo()

    await videoUploadPage.uploadVideo('video2.mp4')
    await videoUploadPage.validSecondUploadStep(video2Name)

    await videoWatchPage.clickOnSave()
    await videoWatchPage.saveToPlaylist(playlistName)
  })

  it('Should have the playlist in my account', async () => {
    if (isUploadUnsupported()) return

    await myAccountPage.navigateToMyPlaylists()

    const videosNumberText = await myAccountPage.getPlaylistVideosText(playlistName)
    expect(videosNumberText).toEqual('2 videos')

    await myAccountPage.clickOnPlaylist(playlistName)

    const count = await myAccountPage.countTotalPlaylistElements()
    expect(count).toEqual(2)
  })

  it('Should watch the playlist', async () => {
    if (isUploadUnsupported()) return

    await myAccountPage.playPlaylist()

    await videoWatchPage.waitUntilVideoName(video2Name, 40 * 1000)
  })

  it('Should watch the Web Video playlist in the embed', async () => {
    if (isUploadUnsupported()) return

    const accessToken = await browser.execute(`return window.localStorage.getItem('access_token');`)
    const refreshToken = await browser.execute(`return window.localStorage.getItem('refresh_token');`)

    await myAccountPage.goOnAssociatedPlaylistEmbed()

    await playerPage.waitUntilPlayerWrapper()

    console.log('Will set %s and %s tokens in local storage.', accessToken, refreshToken)

    await browser.execute(`window.localStorage.setItem('access_token', '${accessToken}');`)
    await browser.execute(`window.localStorage.setItem('refresh_token', '${refreshToken}');`)
    await browser.execute(`window.localStorage.setItem('token_type', 'Bearer');`)

    await browser.refresh()

    await playerPage.playVideo()

    await playerPage.waitUntilPlaylistInfo('2/2', 30 * 1000)
  })

  it('Should watch the HLS playlist in the embed', async () => {
    await videoWatchPage.goOnP2PMediaLoaderPlaylistEmbed()

    await playerPage.playVideo()

    await playerPage.waitUntilPlaylistInfo('2/2', 30 * 1000)
  })

  it('Should delete the video 2', async () => {
    if (isUploadUnsupported()) return

    // Go to the dev website
    await go(videoWatchUrl)

    await myAccountPage.navigateToMyVideos()

    await myAccountPage.removeVideo(video2Name)
    await myAccountPage.validRemove()

    await browser.waitUntil(async () => {
      const count = await myAccountPage.countVideos([ videoName, video2Name ])

      return count === 1
    })
  })

  it('Should delete the first video', async () => {
    if (isUploadUnsupported()) return

    await myAccountPage.removeVideo(videoName)
    await myAccountPage.validRemove()
  })
})
