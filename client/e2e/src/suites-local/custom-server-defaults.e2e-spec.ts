import { LoginPage } from '../po/login.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { isMobileDevice, isSafari, waitServerUp } from '../utils'

describe('Custom server defaults', () => {
  let videoUploadPage: VideoUploadPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    loginPage = new LoginPage()
    videoUploadPage = new VideoUploadPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await browser.maximizeWindow()
  })

  it('Should upload a video with custom default values', async function () {
    await loginPage.loginAsRootUser()
    await videoUploadPage.navigateTo()
    await videoUploadPage.uploadVideo()
    await videoUploadPage.validSecondUploadStep('video')

    await videoWatchPage.waitWatchVideoName('video')

    expect(await videoWatchPage.getPrivacy()).toBe('Internal')
    expect(await videoWatchPage.getLicence()).toBe('Attribution - Non Commercial')
    expect(await videoWatchPage.isDownloadEnabled()).toBeFalsy()
    expect(await videoWatchPage.areCommentsEnabled()).toBeFalsy()
  })

})
