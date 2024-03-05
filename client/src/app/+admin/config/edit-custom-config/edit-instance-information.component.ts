import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, ServerService } from '@app/core'
import { HttpErrorResponse } from '@angular/common/http'
import { genericUploadErrorHandler } from '@app/helpers'
import { ActorImage, HTMLServerConfig } from '@peertube/peertube-models'
import { HelpComponent } from '../../../shared/shared-main/misc/help.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/angular/peertube-template.directive'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { RouterLink } from '@angular/router'
import { SelectCheckboxComponent } from '../../../shared/shared-forms/select/select-checkbox.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { NgClass, NgIf } from '@angular/common'
import { ActorBannerEditComponent } from '../../../shared/shared-actor-image-edit/actor-banner-edit.component'
import { ActorAvatarEditComponent } from '../../../shared/shared-actor-image-edit/actor-avatar-edit.component'
import { InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'

@Component({
  selector: 'my-edit-instance-information',
  templateUrl: './edit-instance-information.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ActorAvatarEditComponent,
    ActorBannerEditComponent,
    NgClass,
    NgIf,
    CustomMarkupHelpComponent,
    MarkdownTextareaComponent,
    SelectCheckboxComponent,
    RouterLink,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    HelpComponent
  ]
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
