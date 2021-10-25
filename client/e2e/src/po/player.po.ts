import { browserSleep, isIOS, isMobileDevice, isSafari } from '../utils'

export class PlayerPage {

  getWatchVideoPlayerCurrentTime () {
    const elem = $('video')

    const p = isIOS()
      ? elem.getAttribute('currentTime')
      : elem.getProperty('currentTime')

    return p.then(t => parseInt(t + '', 10))
            .then(t => Math.ceil(t))
  }

  waitUntilPlaylistInfo (text: string, maxTime: number) {
    return browser.waitUntil(async () => {
      // Without this we have issues on iphone
      await $('.video-js').click()

      return (await $('.video-js .vjs-playlist-info').getText()).includes(text)
    }, { timeout: maxTime })
  }

  waitUntilPlayerWrapper () {
    return browser.waitUntil(async () => {
      return !!(await $('#placeholder-preview'))
    })
  }

  async playAndPauseVideo (isAutoplay: boolean, waitUntilSec: number) {
    const videojsElem = () => $('div.video-js')

    await videojsElem().waitForExist()

    // Autoplay is disabled on iOS and Safari
    if (isIOS() || isSafari() || isMobileDevice()) {
      // We can't play the video if it is not muted
      await browser.execute(`document.querySelector('video').muted = true`)
      await this.clickOnPlayButton()
    } else if (isAutoplay === false) {
      await this.clickOnPlayButton()
    }

    await browserSleep(2000)

    await browser.waitUntil(async () => {
      return (await this.getWatchVideoPlayerCurrentTime()) >= waitUntilSec
    })

    await videojsElem().click()
  }

  async playVideo () {
    return this.clickOnPlayButton()
  }

  private async clickOnPlayButton () {
    const playButton = () => $('.vjs-big-play-button')

    await playButton().waitForClickable()
    await playButton().click()
  }
}
