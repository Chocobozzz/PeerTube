import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild, booleanAttribute } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { getBytes } from '@root-helpers/bytes'
import { imageToDataURL } from '@root-helpers/images'
import { ActorAvatarInput, ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { ActorImage } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { NgbTooltip, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-actor-avatar-edit',
  templateUrl: './actor-avatar-edit.component.html',
  styleUrls: [
    './actor-image-edit.scss',
    './actor-avatar-edit.component.scss'
  ],
  imports: [ NgIf, ActorAvatarComponent, NgbTooltip, GlobalIconComponent, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu ]
})
export class ActorAvatarEditComponent implements OnInit, OnChanges {
  @ViewChild('avatarfileInput') avatarfileInput: ElementRef<HTMLInputElement>

  @Input({ required: true }) actorType: 'channel' | 'account'
  @Input({ required: true }) avatars: ActorImage[]
  @Input({ required: true }) username: string

  @Input() displayName: string
  @Input() subscribers: number

  @Input({ transform: booleanAttribute }) displayUsername = true
  @Input({ transform: booleanAttribute }) editable = true
  @Input({ transform: booleanAttribute }) previewImage = false

  @Output() avatarChange = new EventEmitter<FormData>()
  @Output() avatarDelete = new EventEmitter<void>()

  avatarFormat = ''
  maxAvatarSize = 0
  avatarExtensions = ''

  preview: string

  actor: ActorAvatarInput

  constructor (
    private serverService: ServerService,
    private notifier: Notifier
  ) { }

  ngOnInit (): void {
    const config = this.serverService.getHTMLConfig()

    this.maxAvatarSize = config.avatar.file.size.max
    this.avatarExtensions = config.avatar.file.extensions.join(', ')

    this.avatarFormat = $localize`max size: 192*192px, ${getBytes(this.maxAvatarSize)} extensions: ${this.avatarExtensions}`
  }

  ngOnChanges () {
    this.actor = {
      avatars: this.avatars,
      name: this.username
    }
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
    return !!this.preview || this.avatars.length !== 0
  }
}
