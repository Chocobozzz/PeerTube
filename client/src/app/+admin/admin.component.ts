import { Component, OnInit } from '@angular/core'
import { AuthService, ScreenService, ServerService } from '@app/core'
import { TopMenuDropdownParam } from '@app/shared/shared-main/misc/top-menu-dropdown.component'
import { UserRight } from '@peertube/peertube-models'
import { RouterOutlet } from '@angular/router'
import { NgClass } from '@angular/common'
import { TopMenuDropdownComponent } from '../shared/shared-main/misc/top-menu-dropdown.component'
import { ListOverflowItem } from '@app/shared/shared-main/misc/list-overflow.component'

@Component({
  templateUrl: './admin.component.html',
  styleUrls: [ './admin.component.scss' ],
  standalone: true,
  imports: [ TopMenuDropdownComponent, NgClass, RouterOutlet ]
})
export class AdminComponent implements OnInit {
  items: ListOverflowItem[] = []
  menuEntries: TopMenuDropdownParam[] = []

  constructor (
    private auth: AuthService,
    private screen: ScreenService,
    private server: ServerService
  ) { }

  get isBroadcastMessageDisplayed () {
    return this.screen.isBroadcastMessageDisplayed
  }

  ngOnInit () {
    this.server.configReloaded.subscribe(() => this.buildMenu())

    this.buildMenu()
  }

  private buildMenu () {
    this.menuEntries = []

    this.buildOverviewItems()
    this.buildFederationItems()
    this.buildModerationItems()
    this.buildConfigurationItems()
    this.buildPluginItems()
    this.buildSystemItems()
  }

  private buildOverviewItems () {
    const overviewItems: TopMenuDropdownParam = {
      label: $localize`Overview`,
      children: []
    }

    if (this.hasUsersRight()) {
      overviewItems.children.push({
        label: $localize`Users`,
        routerLink: '/admin/users',
        iconName: 'user'
      })
    }

    if (this.hasVideosRight()) {
      overviewItems.children.push({
        label: $localize`Videos`,
        routerLink: '/admin/videos',
        queryParams: {
          search: 'isLocal:true'
        },
        iconName: 'videos'
      })
    }

    if (this.hasVideoCommentsRight()) {
      overviewItems.children.push({
        label: $localize`Comments`,
        routerLink: '/admin/comments',
        iconName: 'message-circle'
      })
    }

    if (overviewItems.children.length !== 0) {
      this.menuEntries.push(overviewItems)
    }
  }

  private buildFederationItems () {
    if (!this.hasServerFollowRight()) return

    this.menuEntries.push({
      label: $localize`Federation`,
      children: [
        {
          label: $localize`Following`,
          routerLink: '/admin/follows/following-list',
          iconName: 'following'
        },
        {
          label: $localize`Followers`,
          routerLink: '/admin/follows/followers-list',
          iconName: 'follower'
        },
        {
          label: $localize`Video redundancies`,
          routerLink: '/admin/follows/video-redundancies-list',
          iconName: 'videos'
        }
      ]
    })
  }

  private buildModerationItems () {
    const moderationItems: TopMenuDropdownParam = {
      label: $localize`Moderation`,
      children: []
    }

    if (this.hasRegistrationsRight()) {
      moderationItems.children.push({
        label: $localize`Registrations`,
        routerLink: '/admin/moderation/registrations/list',
        iconName: 'user'
      })
    }

    if (this.hasAbusesRight()) {
      moderationItems.children.push({
        label: $localize`Reports`,
        routerLink: '/admin/moderation/abuses/list',
        iconName: 'flag'
      })
    }

    if (this.hasVideoBlocklistRight()) {
      moderationItems.children.push({
        label: $localize`Video blocks`,
        routerLink: '/admin/moderation/video-blocks/list',
        iconName: 'cross'
      })
    }

    if (this.hasAccountsBlocklistRight()) {
      moderationItems.children.push({
        label: $localize`Muted accounts`,
        routerLink: '/admin/moderation/blocklist/accounts',
        iconName: 'user-x'
      })
    }

    if (this.hasServersBlocklistRight()) {
      moderationItems.children.push({
        label: $localize`Muted servers`,
        routerLink: '/admin/moderation/blocklist/servers',
        iconName: 'peertube-x'
      })
    }

    if (moderationItems.children.length !== 0) this.menuEntries.push(moderationItems)
  }

  private buildConfigurationItems () {
    if (this.hasConfigRight()) {
      this.menuEntries.push({ label: $localize`Configuration`, routerLink: '/admin/config' })
    }
  }

  private buildPluginItems () {
    if (this.hasPluginsRight()) {
      this.menuEntries.push({ label: $localize`Plugins/Themes`, routerLink: '/admin/plugins' })
    }
  }

  private buildSystemItems () {
    const systemItems: TopMenuDropdownParam = {
      label: $localize`System`,
      children: []
    }

    if (this.isRemoteRunnersEnabled() && this.hasRunnersRight()) {
      systemItems.children.push({
        label: $localize`Remote runners`,
        iconName: 'codesandbox',
        routerLink: '/admin/system/runners/runners-list'
      })

      systemItems.children.push({
        label: $localize`Runner jobs`,
        iconName: 'globe',
        routerLink: '/admin/system/runners/jobs-list'
      })
    }

    if (this.hasJobsRight()) {
      systemItems.children.push({
        label: $localize`Local jobs`,
        iconName: 'circle-tick',
        routerLink: '/admin/system/jobs'
      })
    }

    if (this.hasLogsRight()) {
      systemItems.children.push({
        label: $localize`Logs`,
        iconName: 'playlists',
        routerLink: '/admin/system/logs'
      })
    }

    if (this.hasDebugRight()) {
      systemItems.children.push({
        label: $localize`Debug`,
        iconName: 'cog',
        routerLink: '/admin/system/debug'
      })
    }

    if (systemItems.children.length !== 0) {
      this.menuEntries.push(systemItems)
    }
  }

  private hasUsersRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_USERS)
  }

  private hasServerFollowRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_SERVER_FOLLOW)
  }

  private hasAbusesRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_ABUSES)
  }

  private hasVideoBlocklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
  }

  private hasAccountsBlocklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)
  }

  private hasServersBlocklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)
  }

  private hasConfigRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_CONFIGURATION)
  }

  private hasPluginsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_PLUGINS)
  }

  private hasLogsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_LOGS)
  }

  private hasJobsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_JOBS)
  }

  private hasRunnersRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_RUNNERS)
  }

  private hasDebugRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_DEBUG)
  }

  private hasVideoCommentsRight () {
    return this.auth.getUser().hasRight(UserRight.SEE_ALL_COMMENTS)
  }

  private hasVideosRight () {
    return this.auth.getUser().hasRight(UserRight.SEE_ALL_VIDEOS)
  }

  private hasRegistrationsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_REGISTRATIONS)
  }

  private isRemoteRunnersEnabled () {
    const config = this.server.getHTMLConfig()

    return config.transcoding.remoteRunners.enabled ||
      config.live.transcoding.remoteRunners.enabled ||
      config.videoStudio.remoteRunners.enabled
  }
}
