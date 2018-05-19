import { by, element, browser } from 'protractor'

export class VideoWatchPage {
  async goOnVideosList (isIphoneDevice: boolean) {
    let url: string

    if (isIphoneDevice === true) {
      // Local testing is buggy :/
      url = 'https://peertube2.cpy.re/videos/local'
    } else {
      url = '/videos/recently-added'
    }

    await browser.get(url)
    return browser.wait(browser.ExpectedConditions.elementToBeClickable(element(this.getFirstVideoListSelector())))
  }

  getVideosListName () {
    return element.all(this.getFirstVideoListSelector())
                  .getText()
                  .then((texts: any) => texts.map(t => t.trim()))
  }

  waitWatchVideoName (videoName: string) {
    const elem = element(by.css('.video-info .video-info-name'))
    return browser.wait(browser.ExpectedConditions.textToBePresentInElement(elem, videoName))
  }

  getWatchVideoPlayerCurrentTime () {
    return element(by.css('.video-js .vjs-current-time-display'))
      .getText()
      .then((t: string) => t.split(':')[1])
      .then(seconds => parseInt(seconds, 10))
  }

  async pauseVideo (pauseAfterMs: number, isMobileDevice: boolean, isIphoneDevice: boolean) {
    if (isMobileDevice === true) {
      if (isIphoneDevice === false) {
        const playButton = element(by.css('.vjs-big-play-button'))
        await browser.wait(browser.ExpectedConditions.elementToBeClickable(playButton))
        await playButton.click()
      } else {
        const playButton = element(by.css('video'))
        await browser.wait(browser.ExpectedConditions.elementToBeClickable(playButton))
        await playButton.click()
      }
    }

    await browser.wait(browser.ExpectedConditions.invisibilityOf(element(by.css('.vjs-loading-spinner'))))

    const el = element(by.css('div.video-js'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(el))

    await browser.sleep(pauseAfterMs)

    if (isIphoneDevice === true) {
      // document.webkitCancelFullScreen()
    } else {
      return el.click()
    }
  }

  async clickOnVideo (videoName: string) {
    const video = element(by.css('.videos .video-miniature .video-thumbnail[title="' + videoName + '"]'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))
    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
  }

  async clickOnFirstVideo () {
    const video = element(by.css('.videos .video-miniature:first-child .video-miniature-name'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))
    const textToReturn = video.getText()

    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
    return textToReturn
  }

  private getFirstVideoListSelector () {
    return by.css('.videos .video-miniature-name')
  }
}
