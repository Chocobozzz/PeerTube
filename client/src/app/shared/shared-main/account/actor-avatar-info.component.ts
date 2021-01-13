import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { getBytes } from '@root-helpers/bytes'
import { Account } from '../account/account.model'
import { VideoChannel } from '../video-channel/video-channel.model'
import { Actor } from './actor.model'

@Component({
  selector: 'my-actor-avatar-info',
  templateUrl: './actor-avatar-info.component.html',
  styleUrls: [ './actor-avatar-info.component.scss' ]
})
export class ActorAvatarInfoComponent implements OnInit, OnChanges {
  @ViewChild('avatarfileInput') avatarfileInput: ElementRef<HTMLInputElement>
  @ViewChild('avatarPopover') avatarPopover: NgbPopover

  @Input() actor: VideoChannel | Account

  @Output() avatarChange = new EventEmitter<FormData>()
  @Output() avatarDelete = new EventEmitter<void>()

  avatarFormat = ''
  maxAvatarSize = 0
  avatarExtensions = ''

  private avatarUrl: string

  constructor (
    private serverService: ServerService,
    private notifier: Notifier
  ) { }

  ngOnInit (): void {
    this.serverService.getConfig()
        .subscribe(config => {
          this.maxAvatarSize = config.avatar.file.size.max
          this.avatarExtensions = config.avatar.file.extensions.join(', ')

          this.avatarFormat = `${$localize`max size`}: 192*192px, ` +
                              `${getBytes(this.maxAvatarSize)} ${$localize`extensions`}: ${this.avatarExtensions}`
        })
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['actor']) {
      this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.actor)
    }
  }

  onAvatarChange (input: HTMLInputElement) {
    this.avatarfileInput = new ElementRef(input)

    const avatarfile = this.avatarfileInput.nativeElement.files[ 0 ]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notifier.error('Error', $localize`This image is too large.`)
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

  hasAvatar () {
    return !!this.avatarUrl
  }
}
