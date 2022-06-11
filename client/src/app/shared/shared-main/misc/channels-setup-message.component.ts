import { Component, Input, OnInit } from '@angular/core'
import { AuthService, User } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main'

@Component({
  selector: 'my-channels-setup-message',
  templateUrl: './channels-setup-message.component.html',
  styleUrls: [ './channels-setup-message.component.scss' ]
})
export class ChannelsSetupMessageComponent implements OnInit {
  @Input() hideLink = false

  user: User = null

  constructor (
    private authService: AuthService
  ) {}

  hasChannelNotConfigured () {
    if (!this.user.videoChannels) return false

    return this.user.videoChannels.filter((channel: VideoChannel) => (!channel.avatar || !channel.description)).length > 0
  }

  ngOnInit () {
    this.user = this.authService.getUser()
  }
}
