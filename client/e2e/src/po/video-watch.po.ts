import { by, element, browser } from 'protractor'

export class VideoWatchPage {
  async goOnVideosList (isIphoneDevice: boolean, isSafari: boolean) {
    let url: string

    if (isIphoneDevice === true) {
      // Local testing is buggy :/
      url = 'https://peertube2.cpy.re/videos/local'
    } else {
      url = '/videos/recently-added'
    }

    await browser.get(url)

    // Waiting the following element does not work on Safari...
    if (isSafari === true) return browser.sleep(3000)

    const elem = element.all(by.css('.videos .video-miniature .video-miniature-name')).first()
    return browser.wait(browser.ExpectedConditions.visibilityOf(elem))
  }

  getVideosListName () {
    return element.all(by.css('.videos .video-miniature .video-miniature-name'))
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

  async pauseVideo (pauseAfterMs: number, isAutoplay: boolean, isSafari: boolean) {
    if (isAutoplay === false) {
      const playButton = element(by.css('.vjs-big-play-button'))
      await browser.wait(browser.ExpectedConditions.elementToBeClickable(playButton))
      await playButton.click()
    }

    if (isSafari === true) {
      await browser.sleep(1000)
      await element(by.css('.vjs-play-control')).click()
    }

    await browser.sleep(1000)
    await browser.wait(browser.ExpectedConditions.invisibilityOf(element(by.css('.vjs-loading-spinner'))))

    const el = element(by.css('div.video-js'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(el))

    await browser.sleep(pauseAfterMs)

    return el.click()
  }

  async clickOnVideo (videoName: string) {
    const video = element(by.css('.videos .video-miniature .video-thumbnail[title="' + videoName + '"]'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))
    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
  }

  async clickOnFirstVideo () {
    const video = element.all(by.css('.videos .video-miniature .video-miniature-name')).first()
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))
    const textToReturn = video.getText()

    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
    return textToReturn
  }

  async goOnAssociatedEmbed () {
    let url = await browser.getCurrentUrl()
    url = url.replace('/watch/', '/embed/')
    url = url.replace(':3333', ':9001')

    return browser.get(url)
  }
}
