import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { ServerService } from '../../core/server'
import { NotificationsService } from 'angular2-notifications'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { Account } from '@app/shared/account/account.model'

@Component({
  selector: 'my-actor-avatar-info',
  templateUrl: './actor-avatar-info.component.html',
  styleUrls: [ './actor-avatar-info.component.scss' ]
})
export class ActorAvatarInfoComponent {
  @ViewChild('avatarfileInput') avatarfileInput: ElementRef<HTMLInputElement>

  @Input() actor: VideoChannel | Account

  @Output() avatarChange = new EventEmitter<FormData>()

  constructor (
    private serverService: ServerService,
    private notificationsService: NotificationsService
  ) {}

  onAvatarChange () {
    const avatarfile = this.avatarfileInput.nativeElement.files[ 0 ]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notificationsService.error('Error', 'This image is too large.')
      return
    }

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)

    this.avatarChange.emit(formData)
  }

  get maxAvatarSize () {
    return this.serverService.getConfig().avatar.file.size.max
  }

  get avatarExtensions () {
    return this.serverService.getConfig().avatar.file.extensions.join(',')
  }
}
