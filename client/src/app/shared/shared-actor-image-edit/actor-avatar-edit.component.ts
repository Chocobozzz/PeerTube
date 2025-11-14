import { Component, ElementRef, OnChanges, OnInit, booleanAttribute, inject, input, output, viewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { ActorImage } from '@peertube/peertube-models'
import { getBytes } from '@root-helpers/bytes'
import { imageToDataURL } from '@root-helpers/images'
import { ActorAvatarComponent, ActorAvatarInput } from '../shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-actor-avatar-edit',
  templateUrl: './actor-avatar-edit.component.html',
  styleUrls: [
    './actor-image-edit.scss',
    './actor-avatar-edit.component.scss'
  ],
  imports: [ ActorAvatarComponent, NgbTooltip, GlobalIconComponent, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu ]
})
export class ActorAvatarEditComponent implements OnInit, OnChanges {
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)

  readonly avatarfileInput = viewChild<ElementRef<HTMLInputElement>>('avatarfileInput')

  readonly actorType = input.required<'channel' | 'account'>()
  readonly avatars = input.required<ActorImage[]>()
  readonly username = input.required<string>()

  readonly displayName = input<string>(undefined)
  readonly subscribers = input<number>(undefined)

  readonly displayUsername = input(true, { transform: booleanAttribute })
  readonly editable = input(true, { transform: booleanAttribute })
  readonly previewImage = input(false, { transform: booleanAttribute })

  readonly avatarChange = output<FormData>()
  readonly avatarDelete = output()

  avatarFormat = ''
  maxAvatarSize = 0
  avatarExtensions = ''

  previewUrl: string

  actor: ActorAvatarInput

  ngOnInit (): void {
    const config = this.serverService.getHTMLConfig()

    this.maxAvatarSize = config.avatar.file.size.max
    this.avatarExtensions = config.avatar.file.extensions.join(', ')

    this.avatarFormat = $localize`max size: ${getBytes(this.maxAvatarSize)} extensions: ${this.avatarExtensions}`
  }

  ngOnChanges () {
    this.previewUrl = undefined

    this.actor = {
      avatars: this.avatars(),
      name: this.username()
    }
  }

  onAvatarChange () {
    const avatarfile = this.avatarfileInput().nativeElement.files[0]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notifier.error('Error', $localize`This image is too large.`)
      return
    }

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)
    this.avatarChange.emit(formData)

    if (this.previewImage()) {
      imageToDataURL(avatarfile).then(result => this.previewUrl = result)
    }
  }

  deleteAvatar () {
    if (this.previewImage()) {
      this.previewUrl = null
      this.actor.avatars = []
    }

    this.avatarDelete.emit()
  }

  hasAvatar () {
    // User deleted the avatar
    if (this.previewUrl === null) return false

    return !!this.previewUrl || this.avatars().length !== 0
  }
}
