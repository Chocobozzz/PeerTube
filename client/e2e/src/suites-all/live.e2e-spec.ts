import { PlayerPage } from '../po/player.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { FIXTURE_URLS, go, isMobileDevice, isSafari, prepareWebBrowser } from '../utils'

describe('Live all workflow', () => {
  let videoWatchPage: VideoWatchPage
  let playerPage: PlayerPage

  beforeEach(async () => {
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())
    playerPage = new PlayerPage()

    await prepareWebBrowser()
  })

  it('Should go to the live page', async () => {
    await go(FIXTURE_URLS.LIVE_VIDEO)

    return videoWatchPage.waitWatchVideoName('E2E - Live')
  })

  it('Should play the live', async () => {
    await playerPage.playAndPauseVideo(false, 45)
    expect(await playerPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(45)
  })

  it('Should watch the associated live embed', async () => {
    await videoWatchPage.goOnAssociatedEmbed()

    await playerPage.playAndPauseVideo(false, 45)
    expect(await playerPage.getWatchVideoPlayerCurrentTime()).toBeGreaterThanOrEqual(45)
  })
})
