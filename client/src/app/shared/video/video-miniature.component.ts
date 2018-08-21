import { Component, Input, OnInit } from '@angular/core'
import { User } from '../users'
import { Video } from './video.model'
import { ServerService } from '@app/core'

export type OwnerDisplayType = 'account' | 'videoChannel' | 'auto'

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html'
})
export class VideoMiniatureComponent implements OnInit {
  @Input() user: User
  @Input() video: Video
  @Input() ownerDisplayType: OwnerDisplayType = 'account'

  private ownerDisplayTypeChosen: 'account' | 'videoChannel'

  constructor (private serverService: ServerService) { }

  ngOnInit () {
    if (this.ownerDisplayType === 'account' || this.ownerDisplayType === 'videoChannel') {
      this.ownerDisplayTypeChosen = this.ownerDisplayType
      return
    }

    // If the video channel name an UUID (not really displayable, we changed this behaviour in v1.0.0-beta.12)
    // -> Use the account name
    if (
      this.video.channel.name === `${this.video.account.name}_channel` ||
      this.video.channel.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    ) {
      this.ownerDisplayTypeChosen = 'account'
    } else {
      this.ownerDisplayTypeChosen = 'videoChannel'
    }
  }

  isVideoBlur () {
    return this.video.isVideoNSFWForUser(this.user, this.serverService.getConfig())
  }

  displayOwnerAccount () {
    return this.ownerDisplayTypeChosen === 'account'
  }

  displayOwnerVideoChannel () {
    return this.ownerDisplayTypeChosen === 'videoChannel'
  }
}
