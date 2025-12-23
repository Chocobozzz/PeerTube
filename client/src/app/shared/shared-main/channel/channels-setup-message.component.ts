import { Component, OnInit, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, User } from '@app/core'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { AlertComponent } from '../common/alert.component'

@Component({
  selector: 'my-channels-setup-message',
  templateUrl: './channels-setup-message.component.html',
  styleUrls: [ './channels-setup-message.component.scss' ],
  imports: [ GlobalIconComponent, RouterLink, AlertComponent ]
})
export class ChannelsSetupMessageComponent implements OnInit {
  private authService = inject(AuthService)

  readonly hideLink = input(false)

  user: User = null

  hasChannelNotConfigured () {
    if (!this.user.videoChannels) return false

    return this.user.videoChannels.filter(c => (c.avatars.length === 0 || !c.description)).length > 0
  }

  ngOnInit () {
    this.user = this.authService.getUser()
  }
}
