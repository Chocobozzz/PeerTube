import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'
import { Notifier, ServerService } from '@app/core'
import { HttpErrorResponse } from '@angular/common/http'
import { genericUploadErrorHandler } from '@app/helpers'
import { InstanceService } from '@app/shared/shared-instance'
import { ActorImage, HTMLServerConfig } from '@peertube/peertube-models'

@Component({
  selector: 'my-edit-instance-information',
  templateUrl: './edit-instance-information.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditInstanceInformationComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: any

  @Input() languageItems: SelectOptionsItem[] = []
  @Input() categoryItems: SelectOptionsItem[] = []

  instanceBannerUrl: string
  instanceAvatars: ActorImage[] = []

  private serverConfig: HTMLServerConfig

  constructor (
    private customMarkup: CustomMarkupService,
    private notifier: Notifier,
    private instanceService: InstanceService,
    private server: ServerService
  ) {

  }

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }

  ngOnInit () {
    this.serverConfig = this.server.getHTMLConfig()

    this.updateActorImages()
  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }

  onBannerChange (formData: FormData) {
    this.instanceService.updateInstanceBanner(formData)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Banner changed.`)

          this.resetActorImages()
        },

        error: (err: HttpErrorResponse) => genericUploadErrorHandler({ err, name: $localize`banner`, notifier: this.notifier })
      })
  }

  onBannerDelete () {
    this.instanceService.deleteInstanceBanner()
      .subscribe({
        next: () => {
          this.notifier.success($localize`Banner deleted.`)

          this.resetActorImages()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  onAvatarChange (formData: FormData) {
    this.instanceService.updateInstanceAvatar(formData)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Avatar changed.`)

          this.resetActorImages()
        },

        error: (err: HttpErrorResponse) => genericUploadErrorHandler({ err, name: $localize`avatar`, notifier: this.notifier })
      })
  }

  onAvatarDelete () {
    this.instanceService.deleteInstanceAvatar()
      .subscribe({
        next: () => {
          this.notifier.success($localize`Avatar deleted.`)

          this.resetActorImages()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private updateActorImages () {
    this.instanceBannerUrl = this.serverConfig.instance.banners?.[0]?.path
    this.instanceAvatars = this.serverConfig.instance.avatars
  }

  private resetActorImages () {
    this.server.resetConfig()
      .subscribe(config => {
        this.serverConfig = config

        this.updateActorImages()
      })
  }

}
