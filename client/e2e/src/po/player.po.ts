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
    return $('#video-wrapper').waitForExist()
  }

  waitUntilPlaying () {
    return $('.video-js.vjs-playing').waitForDisplayed()
  }

  async playAndPauseVideo (isAutoplay: boolean, waitUntilSec: number) {
    // Autoplay is disabled on mobile and Safari
    if (isIOS() || isSafari() || isMobileDevice() || isAutoplay === false) {
      await this.playVideo()
    }

    await $('div.video-js.vjs-has-started').waitForExist()

    await browserSleep(2000)

    await browser.waitUntil(async () => {
      return (await this.getWatchVideoPlayerCurrentTime()) >= waitUntilSec
    }, { timeout: Math.max(waitUntilSec * 2 * 1000, 30000) })

    // Pause video
    await $('div.video-js').click()
  }

  async playVideo () {
    await $('div.video-js.vjs-paused, div.video-js.vjs-playing').waitForExist()

    if (await $('div.video-js.vjs-playing').isExisting()) {
      if (!isIOS()) return

      // On iOS, the web browser may have aborted player autoplay, so check the video is still autoplayed
      await browserSleep(5000)
      if (await $('div.video-js.vjs-playing').isExisting()) return
    }

    // Autoplay is disabled on iOS and Safari
    if (isIOS() || isSafari() || isMobileDevice()) {
      // We can't play the video if it is not muted
      await browser.execute(`document.querySelector('video').muted = true`)
    }

    return this.clickOnPlayButton()
  }

  getPlayButton () {
    return $('.vjs-big-play-button')
  }

  getNSFWContentText () {
    return $('.video-js .nsfw-info').getText()
  }

  getNSFWDetailsContent () {
    return $('.video-js .nsfw-details-content')
  }

  getMoreNSFWInfoButton () {
    return $('.video-js .nsfw-info button')
  }

  async hasPoster () {
    const img = $('.video-js .vjs-poster img')

    return await img.isDisplayed() && (await img.getAttribute('src')).startsWith('http')
  }

  private async clickOnPlayButton () {
    await this.getPlayButton().waitForClickable()
    await this.getPlayButton().click()
  }

  async fillEmbedVideoPassword (videoPassword: string) {
    const videoPasswordInput = $('input#video-password-input')
    const confirmButton = $('button#video-password-submit')

    await videoPasswordInput.clearValue()
    await videoPasswordInput.setValue(videoPassword)
    await confirmButton.waitForClickable()

    return confirmButton.click()
  }
}
