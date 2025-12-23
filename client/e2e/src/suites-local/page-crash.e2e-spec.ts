import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { getScreenshotPath, go, isMobileDevice, isSafari, prepareWebBrowser, selectCustomSelect, waitServerUp } from '../utils'

// These tests help to notice crash with invalid translated strings
describe('Page crash', () => {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage
  let adminConfigPage: AdminConfigPage

  const languages = [
    'العربية',
    'Català',
    'Čeština',
    'Deutsch',
    'ελληνικά',
    'Esperanto',
    'Español',
    'Euskara',
    'فارسی',
    'Suomi',
    'Français',
    'Gàidhlig',
    'Galego',
    'Hrvatski',
    'Magyar',
    'Íslenska',
    'Italiano',
    '日本語',
    'Taqbaylit',
    'Norsk bokmål',
    'Nederlands',
    'Norsk nynorsk',
    'Occitan',
    'Polski',
    'Português (Brasil)',
    'Português (Portugal)',
    'Pусский',
    'Slovenčina',
    'Shqip',
    'Svenska',
    'ไทย',
    'Toki Pona',
    'Türkçe',
    'украї́нська мо́ва',
    'Tiếng Việt',
    '简体中文（中国）',
    '繁體中文（台灣）'
  ]

  before(async () => {
    await waitServerUp()

    adminConfigPage = new AdminConfigPage()
    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await prepareWebBrowser()

    await loginPage.loginAsRootUser()
  })

  for (const language of languages) {
    describe('For language: ' + language, () => {
      it('Should change the language', async function () {
        await go('/')

        await $('.settings-button').waitForClickable()
        await $('.settings-button').click()

        await selectCustomSelect('language', language)

        await $('my-user-interface-settings .primary-button').waitForClickable()
        await $('my-user-interface-settings .primary-button').click()
      })

      it('Should upload and watch a video', async function () {
        await videoPublishPage.navigateTo()
        await videoPublishPage.uploadVideo('video3.mp4')
        await videoPublishPage.validSecondStep('video')

        await videoPublishPage.clickOnWatch()
        await videoWatchPage.waitWatchVideoName('video')
      })

      it('Should set a homepage', async function () {
        await adminConfigPage.updateHomepage('My custom homepage content')
        await adminConfigPage.save()

        // All tests
        await go('/home')

        await $('*=My custom homepage content').waitForDisplayed()
      })

      it('Should go on client pages and not crash', async function () {
        await $('a[href="/videos/overview"]').waitForClickable()
        await $('a[href="/videos/overview"]').click()

        await $('my-video-overview').waitForExist()
      })

      it('Should go on videos from subscriptions pages', async function () {
        await $('a[href="/videos/subscriptions"]').waitForClickable()
        await $('a[href="/videos/subscriptions"]').click()

        await $('my-videos-user-subscriptions').waitForExist()
      })

      after(async () => {
        await browser.saveScreenshot(getScreenshotPath(`after-page-crash-test-${language}.png`))
      })
    })
  }
})
