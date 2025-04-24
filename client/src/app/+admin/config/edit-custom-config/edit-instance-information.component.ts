import { CommonModule } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit, inject, input } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Notifier, ServerService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { SelectRadioComponent } from '@app/shared/shared-forms/select/select-radio.component'
import { InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { maxBy } from '@peertube/peertube-core-utils'
import { ActorImage, HTMLServerConfig } from '@peertube/peertube-models'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { ActorAvatarEditComponent } from '../../../shared/shared-actor-image-edit/actor-avatar-edit.component'
import { ActorBannerEditComponent } from '../../../shared/shared-actor-image-edit/actor-banner-edit.component'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCheckboxComponent } from '../../../shared/shared-forms/select/select-checkbox.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'

@Component({
  selector: 'my-edit-instance-information',
  templateUrl: './edit-instance-information.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ActorAvatarEditComponent,
    ActorBannerEditComponent,
    SelectRadioComponent,
    CommonModule,
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
  private customMarkup = inject(CustomMarkupService)
  private notifier = inject(Notifier)
  private instanceService = inject(InstanceService)
  private server = inject(ServerService)

  readonly form = input<FormGroup>(undefined)
  readonly formErrors = input<any>(undefined)

  readonly languageItems = input<SelectOptionsItem[]>([])
  readonly categoryItems = input<SelectOptionsItem[]>([])

  instanceBannerUrl: string
  instanceAvatars: ActorImage[] = []

  nsfwItems: SelectOptionsItem[] = [
    {
      id: 'do_not_list',
      label: $localize`Hide`
    },
    {
      id: 'warn',
      label: $localize`Warn`
    },
    {
      id: 'blur',
      label: $localize`Blur`
    },
    {
      id: 'display',
      label: $localize`Display`
    }
  ]

  private serverConfig: HTMLServerConfig

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
    this.instanceBannerUrl = maxBy(this.serverConfig.instance.banners, 'width')?.path
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
