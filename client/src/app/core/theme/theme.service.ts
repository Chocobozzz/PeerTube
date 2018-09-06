import { Injectable } from '@angular/core'

@Injectable()
export class ThemeService {
  private theme = document.querySelector('body')
  private previousTheme = {}

  constructor () {
    // initialise the alternative theme with dark theme colors
    this.previousTheme['mainBackgroundColor'] = '#111111'
    this.previousTheme['mainForegroundColor'] = '#fff'
    this.previousTheme['submenuColor'] = 'rgb(32,32,32)'
    this.previousTheme['inputColor'] = 'gray'
    this.previousTheme['inputPlaceholderColor'] = '#fff'
  }

  toggleDarkTheme () {
    // switch properties
    this.switchProperty('mainBackgroundColor')
    this.switchProperty('mainForegroundColor')
    this.switchProperty('submenuColor')
    this.switchProperty('inputColor')
    this.switchProperty('inputPlaceholderColor')
  }

  private switchProperty (property, newValue?) {
    const propertyOldvalue = window.getComputedStyle(this.theme).getPropertyValue('--' + property)
    this.theme.style.setProperty('--' + property, (newValue) ? newValue : this.previousTheme[property])
    this.previousTheme[property] = propertyOldvalue
  }
}
