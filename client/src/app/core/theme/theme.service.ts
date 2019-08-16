import { Injectable } from '@angular/core'
import { AuthService } from '@app/core/auth'
import { ServerService } from '@app/core/server'
import { environment } from '../../../environments/environment'
import { PluginService } from '@app/core/plugins/plugin.service'
import { ServerConfigTheme } from '@shared/models'

@Injectable()
export class ThemeService {

  private oldThemeName: string
  private themes: ServerConfigTheme[] = []

  constructor (
    private auth: AuthService,
    private pluginService: PluginService,
    private server: ServerService
  ) {}

  initialize () {
    this.server.configLoaded
        .subscribe(() => {
          this.injectThemes()

          this.listenUserTheme()
        })
  }

  private injectThemes () {
    this.themes = this.server.getConfig().theme.registered

    console.log('Injecting %d themes.', this.themes.length)

    const head = document.getElementsByTagName('head')[0]

    for (const theme of this.themes) {

      for (const css of theme.css) {
        const link = document.createElement('link')

        const href = environment.apiUrl + `/themes/${theme.name}/${theme.version}/css/${css}`
        link.setAttribute('href', href)
        link.setAttribute('rel', 'alternate stylesheet')
        link.setAttribute('type', 'text/css')
        link.setAttribute('title', theme.name)
        link.setAttribute('disabled', '')

        head.appendChild(link)
      }
    }
  }

  private getCurrentTheme () {
    if (this.auth.isLoggedIn()) {
      const theme = this.auth.getUser().theme
      if (theme !== 'instance-default') return theme
    }

    return this.server.getConfig().theme.default
  }

  private loadTheme (name: string) {
    const links = document.getElementsByTagName('link')
    for (let i = 0; i < links.length; i++) {
      const link = links[ i ]
      if (link.getAttribute('rel').indexOf('style') !== -1 && link.getAttribute('title')) {
        link.disabled = link.getAttribute('title') !== name
      }
    }
  }

  private updateCurrentTheme () {
    if (this.oldThemeName) {
      const oldTheme = this.getTheme(this.oldThemeName)
      if (oldTheme) {
        console.log('Removing scripts of old theme %s.', this.oldThemeName)
        this.pluginService.removePlugin(oldTheme)
      }
    }

    const currentTheme = this.getCurrentTheme()

    console.log('Enabling %s theme.', currentTheme)

    this.loadTheme(currentTheme)

    const theme = this.getTheme(currentTheme)
    if (theme) {
      console.log('Adding scripts of theme %s.', currentTheme)
      this.pluginService.addPlugin(theme, true)

      this.pluginService.reloadLoadedScopes()
    }

    this.oldThemeName = currentTheme
  }

  private listenUserTheme () {
    if (!this.auth.isLoggedIn()) {
      this.updateCurrentTheme()
    }

    this.auth.userInformationLoaded
      .subscribe(() => this.updateCurrentTheme())
  }

  private getTheme (name: string) {
    return this.themes.find(t => t.name === name)
  }
}
