import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import { PlayerPage } from '../po/player.po'
import { SignupPage } from '../po/signup.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { getScreenshotPath, go, isMobileDevice, isSafari, waitServerUp } from '../utils'

describe('Password protected videos', () => {
  let videoUploadPage: VideoUploadPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage
  let signupPage: SignupPage
  let playerPage: PlayerPage
  let myAccountPage: MyAccountPage
  let passwordProtectedVideoUrl: string
  let playlistUrl: string

  const seed = Math.random()
  const passwordProtectedVideoName = seed + ' - password protected'
  const publicVideoName1 = seed + ' - public 1'
  const publicVideoName2 = seed + ' - public 2'
  const videoPassword = 'password'
  const regularUsername = 'user_1'
  const regularUserPassword = 'user password'
  const playlistName = seed + ' - playlist'

  function testRateAndComment () {
    it('Should add and remove like on video', async function () {
      await videoWatchPage.like()
      await videoWatchPage.like()
    })

    it('Should create thread on video', async function () {
      await videoWatchPage.createThread('My first comment')
    })

    it('Should reply to thread on video', async function () {
      await videoWatchPage.createReply('My first reply')
    })
  }

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoUploadPage = new VideoUploadPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())
    signupPage = new SignupPage()
    playerPage = new PlayerPage()
    myAccountPage = new MyAccountPage()

    await browser.maximizeWindow()
  })

  describe('Owner', function () {
    before(async () => {
      await loginPage.loginAsRootUser()
    })

    it('Should login, upload a public video and save it to a playlist', async () => {
      await videoUploadPage.navigateTo()
      await videoUploadPage.uploadVideo('video.mp4')
      await videoUploadPage.validSecondUploadStep(publicVideoName1)

      await videoWatchPage.clickOnSave()

      await videoWatchPage.createPlaylist(playlistName)

      await videoWatchPage.saveToPlaylist(playlistName)
      await browser.pause(5000)

    })

    it('Should upload a password protected video', async () => {
      await videoUploadPage.navigateTo()
      await videoUploadPage.uploadVideo('video2.mp4')
      await videoUploadPage.setAsPasswordProtected(videoPassword)
      await videoUploadPage.validSecondUploadStep(passwordProtectedVideoName)

      await videoWatchPage.waitWatchVideoName(passwordProtectedVideoName)

      passwordProtectedVideoUrl = await browser.getUrl()
    })

    it('Should save to playlist the password protected video', async () => {
      await videoWatchPage.clickOnSave()
      await videoWatchPage.saveToPlaylist(playlistName)
    })

    it('Should upload a second public video and save it to playlist', async () => {
      await videoUploadPage.navigateTo()

      await videoUploadPage.uploadVideo('video3.mp4')
      await videoUploadPage.validSecondUploadStep(publicVideoName2)

      await videoWatchPage.clickOnSave()
      await videoWatchPage.saveToPlaylist(playlistName)
    })

    it('Should play video without password', async function () {
      await go(passwordProtectedVideoUrl)

      expect(!await videoWatchPage.isPasswordProtected())

      await videoWatchPage.waitWatchVideoName(passwordProtectedVideoName)

      expect(await videoWatchPage.getPrivacy()).toBe('Password protected')
      await playerPage.playAndPauseVideo(false, 2)
    })

    testRateAndComment()

    it('Should play video on embed without password', async function () {
      await videoWatchPage.goOnAssociatedEmbed()
      await playerPage.playAndPauseVideo(false, 2)
    })

    it('Should have the playlist in my account', async function () {
      await go('/')
      await myAccountPage.navigateToMyPlaylists()
      const videosNumberText = await myAccountPage.getPlaylistVideosText(playlistName)

      expect(videosNumberText).toEqual('3 videos')
      await myAccountPage.clickOnPlaylist(playlistName)

      const count = await myAccountPage.countTotalPlaylistElements()
      expect(count).toEqual(3)
    })

    it('Should update the playlist to public', async () => {
      const url = await browser.getUrl()
      const regex = /\/my-library\/video-playlists\/([^/]+)/i
      const match = url.match(regex)
      const uuid = match ? match[1] : null

      expect(uuid).not.toBeNull()

      await myAccountPage.updatePlaylistPrivacy(uuid, 'Public')
    })

    it('Should watch the playlist', async () => {
      await myAccountPage.clickOnPlaylist(playlistName)
      await myAccountPage.playPlaylist()

      await videoWatchPage.waitUntilVideoName(publicVideoName1, 40 * 1000)
      playlistUrl = await browser.getUrl()

      await videoWatchPage.waitUntilVideoName(passwordProtectedVideoName, 40 * 1000)
      await videoWatchPage.waitUntilVideoName(publicVideoName2, 40 * 1000)
    })

    after(async () => {
      await loginPage.logout()
    })
  })

  describe('Regular users', function () {

    before(async () => {
      await signupPage.fullSignup({
        accountInfo: {
          username: regularUsername,
          password: regularUserPassword
        },
        channelInfo: {
          name: 'user_1_channel'
        }
      })
    })

    it('Should requires password to play video', async function () {
      await go(passwordProtectedVideoUrl)

      expect(await videoWatchPage.isPasswordProtected())

      await videoWatchPage.fillVideoPassword(videoPassword)
      await videoWatchPage.waitWatchVideoName(passwordProtectedVideoName)

      expect(await videoWatchPage.getPrivacy()).toBe('Password protected')
      await playerPage.playAndPauseVideo(true, 2)
    })

    testRateAndComment()

    it('Should requires password to play video on embed', async function () {
      await videoWatchPage.goOnAssociatedEmbed(true)
      await playerPage.fillEmbedVideoPassword(videoPassword)
      await playerPage.playAndPauseVideo(false, 2)
    })

    it('Should watch the playlist without password protected video', async () => {
      await go(playlistUrl)
      await playerPage.playVideo()
      await videoWatchPage.waitUntilVideoName(publicVideoName2, 40 * 1000)
    })

    after(async () => {
      await loginPage.logout()
    })
  })

  describe('Anonymous users', function () {
    it('Should requires password to play video', async function () {
      await go(passwordProtectedVideoUrl)

      expect(await videoWatchPage.isPasswordProtected())

      await videoWatchPage.fillVideoPassword(videoPassword)
      await videoWatchPage.waitWatchVideoName(passwordProtectedVideoName)

      expect(await videoWatchPage.getPrivacy()).toBe('Password protected')
      await playerPage.playAndPauseVideo(true, 2)
    })

    it('Should requires password to play video on embed', async function () {
      await videoWatchPage.goOnAssociatedEmbed(true)
      await playerPage.fillEmbedVideoPassword(videoPassword)
      await playerPage.playAndPauseVideo(false, 2)
    })

    it('Should watch the playlist without password protected video', async () => {
      await go(playlistUrl)
      await playerPage.playVideo()
      await videoWatchPage.waitUntilVideoName(publicVideoName2, 40 * 1000)
    })
  })

  after(async () => {
    await browser.saveScreenshot(getScreenshotPath('after-test.png'))
  })
})
