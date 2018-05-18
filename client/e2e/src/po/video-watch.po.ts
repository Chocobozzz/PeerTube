import { by, element, browser } from 'protractor'

export class VideoWatchPage {
  async goOnRecentlyAdded () {
    const url = '/videos/recently-added'

    await browser.get(url)
    return browser.wait(browser.ExpectedConditions.elementToBeClickable(element(this.getFirstVideoListSelector())))
  }

  getVideosListName () {
    return element.all(this.getFirstVideoListSelector()).getText()
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

  async pauseVideo (pauseAfterMs: number) {
    await browser.wait(browser.ExpectedConditions.invisibilityOf(element(by.css('.vjs-loading-spinner'))))

    const el = element(by.css('div.video-js'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(el))

    await browser.sleep(pauseAfterMs)

    return el.click()
  }

  async clickOnVideo (videoName: string) {
    const video = element(by.css('.videos .video-miniature .video-thumbnail[title="' + videoName + '"]'))

    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
  }

  private getFirstVideoListSelector () {
    return by.css('.videos .video-miniature-name')
  }
}
