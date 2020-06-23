import { BytesPipe } from 'ngx-pipes'
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { Account, VideoChannel } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig } from '@shared/models'

@Component({
  selector: 'my-actor-avatar-info',
  templateUrl: './actor-avatar-info.component.html',
  styleUrls: [ './actor-avatar-info.component.scss' ]
})
export class ActorAvatarInfoComponent implements OnInit {
  @ViewChild('avatarfileInput') avatarfileInput: ElementRef<HTMLInputElement>

  @Input() actor: VideoChannel | Account

  @Output() avatarChange = new EventEmitter<FormData>()

  maxSizeText: string

  private serverConfig: ServerConfig
  private bytesPipe: BytesPipe

  constructor (
    private serverService: ServerService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    this.bytesPipe = new BytesPipe()
    this.maxSizeText = this.i18n('max size')
  }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)
  }

  onAvatarChange () {
    const avatarfile = this.avatarfileInput.nativeElement.files[ 0 ]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notifier.error('Error', 'This image is too large.')
      return
    }

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)

    this.avatarChange.emit(formData)
  }

  get maxAvatarSize () {
    return this.serverConfig.avatar.file.size.max
  }

  get maxAvatarSizeInBytes () {
    return this.bytesPipe.transform(this.maxAvatarSize)
  }

  get avatarExtensions () {
    return this.serverConfig.avatar.file.extensions.join(', ')
  }
}
