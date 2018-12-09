import { Injectable } from '@angular/core'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'

@Injectable()
export class ThemeService {
  private theme = document.querySelector('body')
  private darkTheme = false
  private previousTheme: { [ id: string ]: string } = {}

  constructor () {
    // initialise the alternative theme with dark theme colors
    this.previousTheme['mainBackgroundColor'] = '#111111'
    this.previousTheme['mainForegroundColor'] = '#fff'
    this.previousTheme['submenuColor'] = 'rgb(32,32,32)'
    this.previousTheme['inputColor'] = 'gray'
    this.previousTheme['inputPlaceholderColor'] = '#fff'

    this.darkTheme = (peertubeLocalStorage.getItem('theme') === 'dark')
    if (this.darkTheme) this.toggleDarkTheme(false)
  }

  toggleDarkTheme (setLocalStorage = true) {
    // switch properties
    this.switchProperty('mainBackgroundColor')
    this.switchProperty('mainForegroundColor')
    this.switchProperty('submenuColor')
    this.switchProperty('inputColor')
    this.switchProperty('inputPlaceholderColor')

    if (setLocalStorage) {
      this.darkTheme = !this.darkTheme
      peertubeLocalStorage.setItem('theme', (this.darkTheme) ? 'dark' : 'default')
    }
  }

  private switchProperty (property: string, newValue?: string) {
    const propertyOldvalue = window.getComputedStyle(this.theme).getPropertyValue('--' + property)
    this.theme.style.setProperty('--' + property, (newValue) ? newValue : this.previousTheme[property])
    this.previousTheme[property] = propertyOldvalue
  }
}
