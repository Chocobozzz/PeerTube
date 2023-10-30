export class VideoSearchPage {

  async search (search: string) {
    await $('#search-video').setValue(search)
    await $('.search-button').click()

    await browser.waitUntil(() => {
      return $('my-video-miniature').isDisplayed()
    })
  }
}
