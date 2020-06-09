import { Component, OnInit } from '@angular/core'
import { UserRight } from '../../../../../shared'
import { AuthService, ServerService } from '@app/core'

@Component({
  templateUrl: './moderation.component.html',
  styleUrls: [ './moderation.component.scss' ]
})
export class ModerationComponent implements OnInit {
  autoBlockVideosEnabled = false

  constructor (
    private auth: AuthService,
    private serverService: ServerService
  ) { }

  ngOnInit (): void {
    this.serverService.getConfig()
      .subscribe(config => this.autoBlockVideosEnabled = config.autoBlacklist.videos.ofUsers.enabled)

  }

  hasVideoAbusesRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_ABUSES)
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
}
