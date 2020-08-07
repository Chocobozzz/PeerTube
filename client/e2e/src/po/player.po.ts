import { browser, by, element, ExpectedConditions } from 'protractor'
import { browserSleep, isIOS, isMobileDevice } from '../utils'

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

  async playAndPauseVideo (isAutoplay: boolean) {
    // Autoplay is disabled on iOS
    if (isAutoplay === false || await isIOS()) {
      await this.clickOnPlayButton()
    }

    await browserSleep(2000)
    await browser.wait(browser.ExpectedConditions.invisibilityOf(element(by.css('.vjs-loading-spinner'))))

    const videojsEl = element(by.css('div.video-js'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(videojsEl))

    if (await isMobileDevice()) {
      await browserSleep(5000)

      // On Android, we need to click twice on "play" (BrowserStack particularity)
      if (!await isIOS()) await videojsEl.click()
    }

    browser.ignoreSynchronization = false
    await browserSleep(7000)
    browser.ignoreSynchronization = true

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
