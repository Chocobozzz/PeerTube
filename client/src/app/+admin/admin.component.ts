import { NgClass } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService, ScreenService, ServerService } from '@app/core'
import { ListOverflowItem } from '@app/shared/shared-main/misc/list-overflow.component'
import { TopMenuDropdownParam } from '@app/shared/shared-main/misc/top-menu-dropdown.component'
import { UserRight, UserRightType } from '@peertube/peertube-models'
import { TopMenuDropdownComponent } from '../shared/shared-main/misc/top-menu-dropdown.component'

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

    if (this.hasRight(UserRight.MANAGE_USERS)) {
      overviewItems.children.push({
        label: $localize`Users`,
        routerLink: '/admin/users',
        iconName: 'user'
      })
    }

    if (this.hasRight(UserRight.SEE_ALL_VIDEOS)) {
      overviewItems.children.push({
        label: $localize`Videos`,
        routerLink: '/admin/videos',
        queryParams: {
          search: 'isLocal:true'
        },
        iconName: 'videos'
      })
    }

    if (this.hasRight(UserRight.SEE_ALL_COMMENTS)) {
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
    if (!this.hasRight(UserRight.MANAGE_SERVER_FOLLOW)) return

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

    if (this.hasRight(UserRight.MANAGE_REGISTRATIONS)) {
      moderationItems.children.push({
        label: $localize`Registrations`,
        routerLink: '/admin/moderation/registrations/list',
        iconName: 'user'
      })
    }

    if (this.hasRight(UserRight.MANAGE_ABUSES)) {
      moderationItems.children.push({
        label: $localize`Reports`,
        routerLink: '/admin/moderation/abuses/list',
        iconName: 'flag'
      })
    }

    if (this.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) {
      moderationItems.children.push({
        label: $localize`Video blocks`,
        routerLink: '/admin/moderation/video-blocks/list',
        iconName: 'cross'
      })
    }

    if (this.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)) {
      moderationItems.children.push({
        label: $localize`Muted accounts`,
        routerLink: '/admin/moderation/blocklist/accounts',
        iconName: 'user-x'
      })
    }

    if (this.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
      moderationItems.children.push({
        label: $localize`Muted servers`,
        routerLink: '/admin/moderation/blocklist/servers',
        iconName: 'peertube-x'
      })
    }

    if (this.hasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS)) {
      moderationItems.children.push({
        label: $localize`Watched words`,
        routerLink: '/admin/moderation/watched-words/list',
        iconName: 'eye-open'
      })
    }

    if (moderationItems.children.length !== 0) this.menuEntries.push(moderationItems)
  }

  private buildConfigurationItems () {
    if (this.hasRight(UserRight.MANAGE_CONFIGURATION)) {
      this.menuEntries.push({ label: $localize`Configuration`, routerLink: '/admin/config' })
    }
  }

  private buildPluginItems () {
    if (this.hasRight(UserRight.MANAGE_PLUGINS)) {
      this.menuEntries.push({ label: $localize`Plugins/Themes`, routerLink: '/admin/plugins' })
    }
  }

  private buildSystemItems () {
    const systemItems: TopMenuDropdownParam = {
      label: $localize`System`,
      children: []
    }

    if (this.isRemoteRunnersEnabled() && this.hasRight(UserRight.MANAGE_RUNNERS)) {
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

    if (this.hasRight(UserRight.MANAGE_JOBS)) {
      systemItems.children.push({
        label: $localize`Local jobs`,
        iconName: 'circle-tick',
        routerLink: '/admin/system/jobs'
      })
    }

    if (this.hasRight(UserRight.MANAGE_LOGS)) {
      systemItems.children.push({
        label: $localize`Logs`,
        iconName: 'playlists',
        routerLink: '/admin/system/logs'
      })
    }

    if (this.hasRight(UserRight.MANAGE_DEBUG)) {
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

  private hasRight (right: UserRightType) {
    return this.auth.getUser().hasRight(right)
  }

  private isRemoteRunnersEnabled () {
    const config = this.server.getHTMLConfig()

    return config.transcoding.remoteRunners.enabled ||
      config.live.transcoding.remoteRunners.enabled ||
      config.videoStudio.remoteRunners.enabled
  }
}
