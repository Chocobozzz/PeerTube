export class VideoSearchPage {

  async search (search: string) {
    await $('#search-video').setValue(search)
    await $('my-header .icon-search').click()

    await browser.waitUntil(() => {
      return $('my-video-miniature').isDisplayed()
    })
  }
}
