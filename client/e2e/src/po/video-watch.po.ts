import { browser, by, element } from 'protractor'

export class VideoWatchPage {
  async goOnVideosList (isMobileDevice: boolean, isSafari: boolean) {
    let url: string

    // We did not upload a file on a mobile device
    if (isMobileDevice === true || isSafari === true) {
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

  waitWatchVideoName (videoName: string, isMobileDevice: boolean, isSafari: boolean) {
    // On mobile we display the first node, on desktop the second
    const index = isMobileDevice ? 0 : 1

    const elem = element.all(by.css('.video-info .video-info-name')).get(index)

    if (isSafari) return browser.sleep(5000)

    return browser.wait(browser.ExpectedConditions.textToBePresentInElement(elem, videoName))
  }

  getWatchVideoPlayerCurrentTime () {
    return element(by.css('.video-js .vjs-current-time-display'))
      .getText()
      .then((t: string) => t.split(':')[1])
      .then(seconds => parseInt(seconds, 10))
  }

  async pauseVideo (isAutoplay: boolean, isMobileDevice: boolean) {
    if (isAutoplay === false) {
      const playButton = element(by.css('.vjs-big-play-button'))
      await browser.wait(browser.ExpectedConditions.elementToBeClickable(playButton))
      await playButton.click()
    }

    await browser.sleep(1000)
    await browser.wait(browser.ExpectedConditions.invisibilityOf(element(by.css('.vjs-loading-spinner'))))

    const videojsEl = element(by.css('div.video-js'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(videojsEl))

    // On Android, we need to click twice on "play" (BrowserStack particularity)
    if (isMobileDevice) {
      await browser.sleep(3000)
      await videojsEl.click()
    }

    await browser.sleep(7000)

    return videojsEl.click()
  }

  async clickOnVideo (videoName: string) {
    const video = element(by.css('.videos .video-miniature .video-thumbnail[title="' + videoName + '"]'))
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))
    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
  }

  async clickOnFirstVideo () {
    const video = element.all(by.css('.videos .video-miniature .video-thumbnail')).first()
    const videoName = element.all(by.css('.videos .video-miniature .video-miniature-name')).first()

    // Don't know why but the expectation fails on Safari
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))

    const textToReturn = videoName.getText()
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
