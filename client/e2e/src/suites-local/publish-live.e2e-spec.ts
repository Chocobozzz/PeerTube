import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { isMobileDevice, isSafari, prepareWebBrowser, waitServerUp } from '../utils'

describe('Publish live', function () {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage
  let adminConfigPage: AdminConfigPage
  let videoWatchPage: VideoWatchPage

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()
    adminConfigPage = new AdminConfigPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await prepareWebBrowser()

    await loginPage.loginAsRootUser()
  })

  it('Should enable live', async function () {
    await adminConfigPage.toggleLive(true)
    await adminConfigPage.save()
  })

  it('Should create a classic permanent live', async function () {
    await videoPublishPage.navigateTo('Go live')

    await videoPublishPage.publishLive()
    await videoPublishPage.validSecondStep('Permanent live test')

    expect(await videoPublishPage.getLiveState()).toEqual('permanent')

    await videoPublishPage.clickOnWatch()

    await videoWatchPage.waitWatchVideoName('Permanent live test')
  })

  it('Should create a permanent live and update it to a normal live', async function () {
    await videoPublishPage.navigateTo('Go live')

    await videoPublishPage.publishLive()
    await videoPublishPage.setNormalLive()
    await videoPublishPage.validSecondStep('Normal live test')
    await videoPublishPage.clickOnWatch()

    await videoWatchPage.waitWatchVideoName('Normal live test')
    await videoWatchPage.clickOnManage()

    expect(await videoPublishPage.getLiveState()).toEqual('normal')
  })
})
