import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { Account, VideoChannel } from '@app/shared/shared-main'
import { getBytes } from '@root-helpers/bytes'
import { imageToDataURL } from '@root-helpers/images'

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

  @Input() actor: VideoChannel | Account
  @Input() editable = true
  @Input() displaySubscribers = true
  @Input() displayUsername = true
  @Input() previewImage = false

  @Output() avatarChange = new EventEmitter<FormData>()
  @Output() avatarDelete = new EventEmitter<void>()

  avatarFormat = ''
  maxAvatarSize = 0
  avatarExtensions = ''

  preview: string

  constructor (
    private serverService: ServerService,
    private notifier: Notifier
  ) { }

  ngOnInit (): void {
    const config = this.serverService.getHTMLConfig()

    this.maxAvatarSize = config.avatar.file.size.max
    this.avatarExtensions = config.avatar.file.extensions.join(', ')

    this.avatarFormat = `${$localize`max size`}: 192*192px, ` +
                        `${getBytes(this.maxAvatarSize)} ${$localize`extensions`}: ${this.avatarExtensions}`
  }

  onAvatarChange (input: HTMLInputElement) {
    this.avatarfileInput = new ElementRef(input)

    const avatarfile = this.avatarfileInput.nativeElement.files[0]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notifier.error('Error', $localize`This image is too large.`)
      return
    }

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)
    this.avatarChange.emit(formData)

    if (this.previewImage) {
      imageToDataURL(avatarfile).then(result => this.preview = result)
    }
  }

  deleteAvatar () {
    this.preview = undefined
    this.avatarDelete.emit()
  }

  hasAvatar () {
    return !!this.preview || this.actor.avatars.length !== 0
  }

  getActorType () {
    if ((this.actor as VideoChannel).ownerAccount) return 'channel'

    return 'account'
  }
}
