import { Component, OnInit } from '@angular/core'
import { AuthService } from '@app/core'
import { ListOverflowItem } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserRight } from '@shared/models'
import { TopMenuDropdownParam } from '@app/shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  templateUrl: './admin.component.html',
  styleUrls: [ './admin.component.scss' ]
})
export class AdminComponent implements OnInit {
  items: ListOverflowItem[] = []
  menuEntries: TopMenuDropdownParam[] = []

  constructor (
    private auth: AuthService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    const federationItems: TopMenuDropdownParam = {
      label: this.i18n('Federation'),
      isDisplayed: () => true,
      children: [
        {
          label: this.i18n('Instances you follow'),
          routerLink: '/admin/follows/following-list',
          iconName: 'following',
          isDisplayed: () => true
        },
        {
          label: this.i18n('Instances following you'),
          routerLink: '/admin/follows/followers-list',
          iconName: 'follower',
          isDisplayed: () => true
        },
        {
          label: this.i18n('Video redundancies'),
          routerLink: '/admin/follows/video-redundancies-list',
          iconName: 'videos',
          isDisplayed: () => true
        }
      ]
    }

    const moderationItems: TopMenuDropdownParam = {
      label: this.i18n('Moderation'),
      children: [],
      isDisplayed: () => true
    }

    if (this.hasAbusesRight()) {
      moderationItems.children.push({
        label: this.i18n('Reports'),
        routerLink: '/admin/moderation/abuses/list',
        iconName: 'flag',
        isDisplayed: () => true
      })
    }
    if (this.hasVideoBlocklistRight()) {
      moderationItems.children.push({
        label: this.i18n('Video blocks'),
        routerLink: '/admin/moderation/video-blocks/list',
        iconName: 'cross',
        isDisplayed: () => true
      })
    }
    if (this.hasAccountsBlocklistRight()) {
      moderationItems.children.push({
        label: this.i18n('Muted accounts'),
        routerLink: '/admin/moderation/blocklist/accounts',
        iconName: 'user-x',
        isDisplayed: () => true
      })
    }
    if (this.hasServersBlocklistRight()) {
      moderationItems.children.push({
        label: this.i18n('Muted servers'),
        routerLink: '/admin/moderation/blocklist/servers',
        iconName: 'peertube-x',
        isDisplayed: () => true
      })
    }

    if (this.hasUsersRight()) {
      this.menuEntries.push({ label: this.i18n('Users'), routerLink: '/admin/users', isDisplayed: () => true })
    }

    if (this.hasServerFollowRight()) this.menuEntries.push(federationItems)
    if (this.hasAbusesRight() || this.hasVideoBlocklistRight()) this.menuEntries.push(moderationItems)

    if (this.hasConfigRight()) {
      this.menuEntries.push({ label: this.i18n('Configuration'), routerLink: '/admin/config', isDisplayed: () => true })
    }

    if (this.hasPluginsRight()) {
      this.menuEntries.push({ label: this.i18n('Plugins/Themes'), routerLink: '/admin/plugins', isDisplayed: () => true })
    }

    if (this.hasJobsRight() || this.hasLogsRight() || this.hasDebugRight()) {
      this.menuEntries.push({ label: this.i18n('System'), routerLink: '/admin/system', isDisplayed: () => true })
    }
  }

  hasUsersRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_USERS)
  }

  hasServerFollowRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_SERVER_FOLLOW)
  }

  hasAbusesRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_ABUSES)
  }

  hasVideoBlocklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
  }

  hasAccountsBlocklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)
  }

  hasServersBlocklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)
  }

  hasConfigRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_CONFIGURATION)
  }

  hasPluginsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_PLUGINS)
  }

  hasLogsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_LOGS)
  }

  hasJobsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_JOBS)
  }

  hasDebugRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_DEBUG)
  }
}
