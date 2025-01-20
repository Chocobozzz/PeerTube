import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService, ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { PluginType, UserRight, UserRightType } from '@peertube/peertube-models'

@Component({
  templateUrl: './admin-settings.component.html',
  standalone: true,
  imports: [ HorizontalMenuComponent, RouterOutlet ]
})
export class AdminSettingsComponent implements OnInit {
  menuEntries: HorizontalMenuEntry[] = []

  constructor (
    private auth: AuthService,
    private server: ServerService
  ) { }

  ngOnInit () {
    this.server.configReloaded.subscribe(() => this.buildMenu())

    this.buildMenu()
  }

  private buildMenu () {
    this.menuEntries = []

    this.buildConfigurationItems()
    this.buildFederationItems()
    this.buildPluginItems()
    this.buildRunnerItems()
    this.buildSystemItems()
  }

  private buildFederationItems () {
    if (!this.hasRight(UserRight.MANAGE_SERVER_FOLLOW)) return

    this.menuEntries.push({
      label: $localize`Federation`,
      routerLink: '/admin/settings/follows/following-list',
      children: [
        {
          label: $localize`Following`,
          routerLink: '/admin/settings/follows/following-list'
        },
        {
          label: $localize`Followers`,
          routerLink: '/admin/settings/follows/followers-list'
        },
        {
          label: $localize`Video redundancies`,
          routerLink: '/admin/settings/follows/video-redundancies-list'
        }
      ]
    })
  }

  private buildConfigurationItems () {
    if (this.hasRight(UserRight.MANAGE_CONFIGURATION)) {
      this.menuEntries.push({ label: $localize`Configuration`, routerLink: '/admin/settings/config' })
    }
  }

  private buildPluginItems () {
    if (this.hasRight(UserRight.MANAGE_PLUGINS)) {
      this.menuEntries.push({
        label: $localize`Plugins/Themes`,
        routerLink: '/admin/settings/plugins',
        queryParams: {
          pluginType: PluginType.PLUGIN
        },
        children: [
          {
            label: $localize`Installed plugins`,
            routerLink: '/admin/settings/plugins/list-installed',
            queryParams: {
              pluginType: PluginType.PLUGIN
            }
          },
          {
            label: $localize`Search plugins`,
            routerLink: '/admin/settings/plugins/search',
            queryParams: {
              pluginType: PluginType.PLUGIN
            }
          },
          {
            label: $localize`Installed themes`,
            routerLink: '/admin/settings/plugins/list-installed',
            queryParams: {
              pluginType: PluginType.THEME
            }
          },
          {
            label: $localize`Search themes`,
            routerLink: '/admin/settings/plugins/search',
            queryParams: {
              pluginType: PluginType.THEME
            }
          }
        ]
      })
    }
  }

  private buildRunnerItems () {
    if (!this.isRemoteRunnersEnabled() || !this.hasRight(UserRight.MANAGE_RUNNERS)) return

    this.menuEntries.push({
      label: $localize`Runners`,
      routerLink: '/admin/settings/system/runners/runners-list',
      children: [
        {
          label: $localize`Remote runners`,
          routerLink: '/admin/settings/system/runners/runners-list'
        },

        {
          label: $localize`Runner jobs`,
          routerLink: '/admin/settings/system/runners/jobs-list'
        },

        {
          label: $localize`Registration tokens`,
          routerLink: '/admin/settings/system/runners/registration-tokens-list'
        }
      ]
    })
  }

  private buildSystemItems () {
    const systemItems: HorizontalMenuEntry = {
      label: $localize`System`,
      routerLink: '',
      children: []
    }

    if (this.hasRight(UserRight.MANAGE_JOBS)) {
      systemItems.children.push({
        label: $localize`Local jobs`,
        routerLink: '/admin/settings/system/jobs'
      })
    }

    if (this.hasRight(UserRight.MANAGE_LOGS)) {
      systemItems.children.push({
        label: $localize`Logs`,
        routerLink: '/admin/settings/system/logs'
      })
    }

    if (this.hasRight(UserRight.MANAGE_DEBUG)) {
      systemItems.children.push({
        label: $localize`Debug`,
        routerLink: '/admin/settings/system/debug'
      })
    }

    if (systemItems.children.length === 0) return

    systemItems.routerLink = systemItems.children[0].routerLink

    this.menuEntries.push(systemItems)
  }

  private hasRight (right: UserRightType) {
    return this.auth.getUser().hasRight(right)
  }

  private isRemoteRunnersEnabled () {
    const config = this.server.getHTMLConfig()

    return config.transcoding.remoteRunners.enabled ||
      config.live.transcoding.remoteRunners.enabled ||
      config.videoStudio.remoteRunners.enabled ||
      config.videoTranscription.remoteRunners.enabled
  }
}
