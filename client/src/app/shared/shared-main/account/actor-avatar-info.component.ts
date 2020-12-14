import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { getBytes } from '@root-helpers/bytes'
import { ServerConfig } from '@shared/models'
import { VideoChannel } from '../video-channel/video-channel.model'
import { Account } from '../account/account.model'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { Actor } from './actor.model'

@Component({
  selector: 'my-actor-avatar-info',
  templateUrl: './actor-avatar-info.component.html',
  styleUrls: [ './actor-avatar-info.component.scss' ]
})
export class ActorAvatarInfoComponent implements OnInit {
  @ViewChild('avatarfileInput') avatarfileInput: ElementRef<HTMLInputElement>
  @ViewChild('avatarPopover') avatarPopover: NgbPopover

  @Input() actor: VideoChannel | Account

  @Output() avatarChange = new EventEmitter<FormData>()
  @Output() avatarDelete = new EventEmitter<void>()

  private serverConfig: ServerConfig

  constructor (
    private serverService: ServerService,
    private notifier: Notifier
  ) { }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)
  }

  onAvatarChange (input: HTMLInputElement) {
    this.avatarfileInput = new ElementRef(input)

    const avatarfile = this.avatarfileInput.nativeElement.files[ 0 ]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notifier.error('Error', 'This image is too large.')
      return
    }

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)
    this.avatarPopover?.close()
    this.avatarChange.emit(formData)
  }

  deleteAvatar () {
    this.avatarDelete.emit()
  }

  get maxAvatarSize () {
    return this.serverConfig.avatar.file.size.max
  }

  get maxAvatarSizeInBytes () {
    return getBytes(this.maxAvatarSize)
  }

  get avatarExtensions () {
    return this.serverConfig.avatar.file.extensions.join(', ')
  }

  get avatarFormat () {
    return `${$localize`max size`}: 192*192px, ${this.maxAvatarSizeInBytes} ${$localize`extensions`}: ${this.avatarExtensions}`
  }

  get hasAvatar () {
    return Actor.GET_ACTOR_AVATAR_URL(this.actor)
  }
}
