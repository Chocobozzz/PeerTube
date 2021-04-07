import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { Account, VideoChannel } from '@app/shared/shared-main'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { getBytes } from '@root-helpers/bytes'

@Component({
  selector: 'my-actor-avatar-edit',
  templateUrl: './actor-avatar-edit.component.html',
  styleUrls: [
    './actor-image-edit.scss',
    './actor-avatar-edit.component.scss'
  ]
})
export class ActorAvatarEditComponent implements OnInit {
  @ViewChild('avatarfileInput') avatarfileInput: ElementRef<HTMLInputElement>
  @ViewChild('avatarPopover') avatarPopover: NgbPopover

  @Input() actor: VideoChannel | Account
  @Input() editable = true
  @Input() displaySubscribers = true
  @Input() displayUsername = true

  @Output() avatarChange = new EventEmitter<FormData>()
  @Output() avatarDelete = new EventEmitter<void>()

  avatarFormat = ''
  maxAvatarSize = 0
  avatarExtensions = ''

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
    return !!this.actor.avatar
  }

  isChannel () {
    return !!(this.actor as VideoChannel).ownerAccount
  }
}
