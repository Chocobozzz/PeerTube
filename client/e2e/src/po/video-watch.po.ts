import { browserSleep, FIXTURE_URLS, go } from '../utils'

export class VideoWatchPage {

  constructor (private isMobileDevice: boolean, private isSafari: boolean) {

  }

  waitWatchVideoName (videoName: string) {
    if (this.isSafari) return browserSleep(5000)

    // On mobile we display the first node, on desktop the second one
    const index = this.isMobileDevice ? 0 : 1

    return browser.waitUntil(async () => {
      if (!await $('.video-info .video-info-name').isExisting()) return false

      const elem = await $$('.video-info .video-info-name')[index]

      return (await elem.getText()).includes(videoName) && elem.isDisplayed()
    })
  }

  getVideoName () {
    return this.getVideoNameElement().then(e => e.getText())
  }

  getPrivacy () {
    return $('.attribute-privacy .attribute-value').getText()
  }

  getLicence () {
    return $('.attribute-licence .attribute-value').getText()
  }

  async isDownloadEnabled () {
    try {
      await this.clickOnMoreDropdownIcon()

      return await $('.dropdown-item .icon-download').isExisting()
    } catch {
      return $('.action-button-download').isDisplayed()
    }
  }

  areCommentsEnabled () {
    return $('my-video-comment-add').isExisting()
  }

  isPrivacyWarningDisplayed () {
    return $('my-privacy-concerns').isDisplayed()
  }

  async goOnAssociatedEmbed (passwordProtected = false) {
    let url = await browser.getUrl()
    url = url.replace('/w/', '/videos/embed/')
    url = url.replace(':3333', ':9001')

    await go(url)

    if (passwordProtected) await this.waitEmbedForVideoPasswordForm()
    else await this.waitEmbedForDisplayed()
  }

  waitEmbedForDisplayed () {
    return $('.vjs-big-play-button').waitForDisplayed()
  }

  waitEmbedForVideoPasswordForm () {
    return $('#video-password-input').waitForDisplayed()
  }

  isEmbedWarningDisplayed () {
    return $('.peertube-dock-description').isDisplayed()
  }

  goOnP2PMediaLoaderEmbed () {
    return go(FIXTURE_URLS.HLS_EMBED)
  }

  goOnP2PMediaLoaderPlaylistEmbed () {
    return go(FIXTURE_URLS.HLS_PLAYLIST_EMBED)
  }

  async clickOnUpdate () {
    await this.clickOnMoreDropdownIcon()

    const items = await $$('.dropdown-menu.show .dropdown-item')

    for (const item of items) {
      const href = await item.getAttribute('href')

      if (href?.includes('/update/')) {
        await item.click()
        return
      }
    }
  }

  clickOnSave () {
    return $('.action-button-save').click()
  }

  async createPlaylist (name: string) {
    const newPlaylistButton = () => $('.new-playlist-button')

    await newPlaylistButton().waitForClickable()
    await newPlaylistButton().click()

    const displayName = () => $('#displayName')

    await displayName().waitForDisplayed()
    await displayName().setValue(name)

    return $('.new-playlist-block input[type=submit]').click()
  }

  async saveToPlaylist (name: string) {
    const playlist = () => $('my-video-add-to-playlist').$(`.playlist=${name}`)

    await playlist().waitForDisplayed()

    return playlist().click()
  }

  waitUntilVideoName (name: string, maxTime: number) {
    return browser.waitUntil(async () => {
      return (await this.getVideoName()) === name
    }, { timeout: maxTime })
  }

  async clickOnMoreDropdownIcon () {
    const dropdown = $('my-video-actions-dropdown .action-button')
    await dropdown.click()

    await $('.dropdown-menu.show .dropdown-item').waitForDisplayed()
  }

  private async getVideoNameElement () {
    // We have 2 video info name block, pick the first that is not empty
    const elem = async () => {
      const elems = await $$('.video-info-first-row .video-info-name').filter(e => e.isDisplayed())

      return elems[0]
    }

    await browser.waitUntil(async () => {
      const e = await elem()

      return e?.isDisplayed()
    })

    return elem()
  }

  isPasswordProtected () {
    return $('#confirmInput').isExisting()
  }

  async fillVideoPassword (videoPassword: string) {
    const videoPasswordInput = await $('input#confirmInput')
    await videoPasswordInput.waitForClickable()
    await videoPasswordInput.clearValue()
    await videoPasswordInput.setValue(videoPassword)

    const confirmButton = await $('input[value="Confirm"]')
    await confirmButton.waitForClickable()
    return confirmButton.click()
  }

  async like () {
    const likeButton = await $('.action-button-like')
    const isActivated = (await likeButton.getAttribute('class')).includes('activated')

    let count: number
    try {
      count = parseInt(await $('.action-button-like > .count').getText())
    } catch (error) {
      count = 0
    }

    await likeButton.waitForClickable()
    await likeButton.click()

    if (isActivated) {
      if (count === 1) {
        return expect(!await $('.action-button-like > .count').isExisting())
      } else {
        return expect(parseInt(await $('.action-button-like > .count').getText())).toBe(count - 1)
      }
    } else {
      return expect(parseInt(await $('.action-button-like > .count').getText())).toBe(count + 1)
    }
  }

  async createThread (comment: string) {
    const textarea = await $('my-video-comment-add textarea')
    await textarea.waitForClickable()

    await textarea.setValue(comment)

    const confirmButton = await $('.comment-buttons .primary-button')
    await confirmButton.waitForClickable()
    await confirmButton.click()

    const createdComment = await (await $('.comment-html p')).getText()

    return expect(createdComment).toBe(comment)
  }

  async createReply (comment: string) {
    const replyButton = await $('button.comment-action-reply')
    await replyButton.waitForClickable()
    await replyButton.scrollIntoView({ block: 'center' })
    await replyButton.click()

    const textarea = await $('my-video-comment my-video-comment-add textarea')
    await textarea.waitForClickable()
    await textarea.setValue(comment)

    const confirmButton = await $('my-video-comment .comment-buttons .primary-button')
    await confirmButton.waitForClickable()
    await replyButton.scrollIntoView({ block: 'center' })
    await confirmButton.click()

    const createdComment = await $('.is-child .comment-html p')
    await createdComment.waitForDisplayed()

    return expect(await createdComment.getText()).toBe(comment)
  }
}
