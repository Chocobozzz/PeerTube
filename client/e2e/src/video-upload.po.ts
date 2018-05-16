import { browser } from 'protractor'

export class VideoUploadPage {
  navigateTo () {
    return browser.get('/videos/upload')
  }
}
