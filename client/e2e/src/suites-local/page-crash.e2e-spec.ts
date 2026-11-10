/* eslint-disable no-loop-func */

import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { browserSleep, getScreenshotPath, go, isSafari, prepareWebBrowser, selectCustomSelect, waitServerUp } from '../utils'

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
    'ქართული ენა',
    'Taqbaylit',
    '한국어',
    'Norsk bokmål',
    'Nederlands',
    'Norsk nynorsk',
    'Occitan',
    'Polski',
    'Português (Brasil)',
    'Português (Portugal)',
    'Română',
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
    loginPage = new LoginPage()
    videoPublishPage = new VideoPublishPage()
    videoWatchPage = new VideoWatchPage(isSafari())

    await prepareWebBrowser()
  })

  for (const language of languages) {
    describe('For language: ' + language, () => {
      describe('Logged in user', () => {
        before(async () => {
          await loginPage.loginAsRootUser()
        })

        it('Should change the language', async function () {
          await go('/my-account/settings')

          await selectCustomSelect('language', language)

          // The client reloads the page to apply the new language: mark the current page to detect the reload
          await browser.execute(() => {
            ;(window as any).beforeLanguageChange = true
          })

          await $('my-user-interface-settings .primary-button').waitForClickable()
          await $('my-user-interface-settings .primary-button').click()

          // Taking a screenshot in the middle of the reload hangs the browser, so wait for the new page
          await browser.waitUntil(async () => {
            try {
              const reloaded = await browser.execute(() => (window as any).beforeLanguageChange !== true)
              if (!reloaded) return false

              return await $('my-user-interface-settings').isDisplayed()
            } catch {
              return false
            }
          }, { timeout: 20000 })
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

          // Don't use the "*=" text selector: Firefox doesn't find the element with it
          const homepage = $('my-custom-markup-container')
          await homepage.waitForDisplayed()
          await expect(homepage).toHaveText(expect.stringContaining('My custom homepage content'))
        })

        it('Should go on overview page and not crash', async function () {
          await $('a[href="/videos/overview"]').waitForClickable()
          await $('a[href="/videos/overview"]').click()

          await $('my-video-overview').waitForExist()
        })

        it('Should go on videos from subscriptions page', async function () {
          await $('a[href="/videos/subscriptions"]').waitForClickable()
          await $('a[href="/videos/subscriptions"]').click()

          await $('my-videos-user-subscriptions').waitForExist()
        })
      })

      describe('Anonymous user', () => {
        before(async () => {
          await adminConfigPage.toggleSignup(true)

          await adminConfigPage.save()

          await loginPage.logout()
          await browser.refresh()
        })

        it('Should go on signup page', async function () {
          const button = $('.create-account-button')

          // A pending redirection (home page) can override our navigation, so click again if needed
          await browser.waitUntil(async () => {
            await button.waitForClickable()
            await button.click()

            await browserSleep(500)

            return (await browser.getUrl()).includes('/signup')
          }, { timeout: 10000 })

          await $('.callout-content > h4').waitForExist()
        })
      })

      after(async () => {
        await browser.saveScreenshot(getScreenshotPath(`after-page-crash-test-${language}.png`))
      })
    })
  }
})
