import { Component, Input, OnInit } from '@angular/core'
import { HTMLServerConfig } from '@shared/models/server'
import { ServerService } from '@app/core'
import { User } from '@app/core'

@Component({
    selector: 'my-user-video-channels-quota',
    templateUrl: './user-video-channels-quota.component.html',
    styleUrls: [ './user-video-channels-quota.component.scss' ]
})

export class UserVideoChannelsQuotaComponent implements OnInit {
  @Input() user: User = null

  maxVideoChannelsQuota = 20
  userVideoChannels = 1
  userVideoChannelsPercentage = 5

  private serverConfig: HTMLServerConfig

  constructor (
    private serverService: ServerService
  ) { }

  ngOnInit() {
    this.serverConfig = this.serverService.getHTMLConfig()
    this.maxVideoChannelsQuota = this.serverConfig.videoChannels.maxPerUser

    this.userVideoChannels = this.user.videoChannels.length

    this.userVideoChannelsPercentage = (this.userVideoChannels * 100) / this.maxVideoChannelsQuota
  }

  titleVideoChannelsQuota () {
    return `${ this.userVideoChannels } / ${ this.maxVideoChannelsQuota }`
  }
}