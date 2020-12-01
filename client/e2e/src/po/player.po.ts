import { browser, by, element } from 'protractor'
import { browserSleep, isIOS, isMobileDevice, isSafari } from '../utils'

export class PlayerPage {

  getWatchVideoPlayerCurrentTime () {
    return element(by.css('.video-js .vjs-current-time-display'))
      .getText()
      .then((t: string) => t.split(':')[1])
      .then(seconds => parseInt(seconds, 10))
  }

  waitUntilPlaylistInfo (text: string) {
    const elem = element(by.css('.video-js .vjs-playlist-info'))

    return browser.wait(browser.ExpectedConditions.textToBePresentInElement(elem, text))
  }

  waitUntilPlayerWrapper () {
    const elem = element(by.css('#placeholder-preview'))

    return browser.wait(browser.ExpectedConditions.presenceOf(elem))
  }

  async playAndPauseVideo (isAutoplay: boolean) {
    const videojsEl = element(by.css('div.video-js'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(videojsEl))

    // Autoplay is disabled on iOS and Safari
    if (await isIOS() || await isSafari() || await isMobileDevice()) {
      // We can't play the video using protractor if it is not muted
      await browser.executeScript(`document.querySelector('video').muted = true`)
      await this.clickOnPlayButton()
    } else if (isAutoplay === false) {
      await this.clickOnPlayButton()
    }

    await browserSleep(2000)
    await browser.wait(browser.ExpectedConditions.invisibilityOf(element(by.css('.vjs-loading-spinner'))))

    await browserSleep(2000)

    await videojsEl.click()
  }

  async playVideo () {
    return this.clickOnPlayButton()
  }

  private async clickOnPlayButton () {
    const playButton = element(by.css('.vjs-big-play-button'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(playButton))
    await playButton.click()
  }
}
