import { LoginPage } from '../po/login.po'
import { PlayerPage } from '../po/player.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { FIXTURE_URLS, go, isMobileDevice, isSafari } from '../utils'

async function checkCorrectlyPlay (playerPage: PlayerPage) {
  await playerPage.playAndPauseVideo(false, 2)

  expect(await playerPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(2)
}

describe('Private videos all workflow', () => {
  let videoWatchPage: VideoWatchPage
  let loginPage: LoginPage
  let playerPage: PlayerPage

  const internalVideoName = 'Internal E2E test'
  const internalHLSOnlyVideoName = 'Internal E2E test - HLS only'

  beforeEach(async () => {
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())
    loginPage = new LoginPage(isMobileDevice())
    playerPage = new PlayerPage()

    if (!isMobileDevice()) {
      await browser.maximizeWindow()
    }
  })

  it('Should log in', async () => {
    return loginPage.loginOnPeerTube2()
  })

  it('Should play an internal webtorrent video', async () => {
    await go(FIXTURE_URLS.INTERNAL_WEBTORRENT_VIDEO)

    await videoWatchPage.waitWatchVideoName(internalVideoName)
    await checkCorrectlyPlay(playerPage)
  })

  it('Should play an internal HLS video', async () => {
    await go(FIXTURE_URLS.INTERNAL_HLS_VIDEO)

    await videoWatchPage.waitWatchVideoName(internalVideoName)
    await checkCorrectlyPlay(playerPage)
  })

  it('Should play an internal HLS only video', async () => {
    await go(FIXTURE_URLS.INTERNAL_HLS_ONLY_VIDEO)

    await videoWatchPage.waitWatchVideoName(internalHLSOnlyVideoName)
    await checkCorrectlyPlay(playerPage)
  })

  it('Should play an internal WebTorrent video in embed', async () => {
    await go(FIXTURE_URLS.INTERNAL_EMBED_WEBTORRENT_VIDEO)

    await videoWatchPage.waitEmbedForDisplayed()
    await checkCorrectlyPlay(playerPage)
  })

  it('Should play an internal HLS video in embed', async () => {
    await go(FIXTURE_URLS.INTERNAL_EMBED_HLS_VIDEO)

    await videoWatchPage.waitEmbedForDisplayed()
    await checkCorrectlyPlay(playerPage)
  })

  it('Should play an internal HLS only video in embed', async () => {
    await go(FIXTURE_URLS.INTERNAL_EMBED_HLS_ONLY_VIDEO)

    await videoWatchPage.waitEmbedForDisplayed()
    await checkCorrectlyPlay(playerPage)
  })
})
