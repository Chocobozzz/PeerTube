import { CommonModule } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import { URL_VALIDATOR } from '@app/shared/form-validators/common-validators'
import {
  ADMIN_EMAIL_VALIDATOR,
  INSTANCE_NAME_VALIDATOR,
  INSTANCE_SHORT_DESCRIPTION_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { SelectRadioComponent } from '@app/shared/shared-forms/select/select-radio.component'
import { InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { maxBy } from '@peertube/peertube-core-utils'
import { ActorImage, CustomConfig, HTMLServerConfig, NSFWPolicyType, VideoConstant } from '@peertube/peertube-models'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { ActorAvatarEditComponent } from '../../../shared/shared-actor-image-edit/actor-avatar-edit.component'
import { ActorBannerEditComponent } from '../../../shared/shared-actor-image-edit/actor-banner-edit.component'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCheckboxComponent } from '../../../shared/shared-forms/select/select-checkbox.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { AdminConfigService } from '../shared/admin-config.service'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type Form = {
  admin: FormGroup<{
    email: FormControl<string>
  }>

  contactForm: FormGroup<{
    enabled: FormControl<boolean>
  }>

  instance: FormGroup<{
    name: FormControl<string>
    shortDescription: FormControl<string>
    description: FormControl<string>
    categories: FormControl<number[]>
    languages: FormControl<string[]>
    serverCountry: FormControl<string>

    support: FormGroup<{
      text: FormControl<string>
    }>

    social: FormGroup<{
      externalLink: FormControl<string>
      mastodonLink: FormControl<string>
      blueskyLink: FormControl<string>
    }>

    isNSFW: FormControl<boolean>
    defaultNSFWPolicy: FormControl<NSFWPolicyType>

    terms: FormControl<string>
    codeOfConduct: FormControl<string>
    moderationInformation: FormControl<string>
    administrator: FormControl<string>
    creationReason: FormControl<string>
    maintenanceLifetime: FormControl<string>
    businessModel: FormControl<string>
    hardwareInformation: FormControl<string>
  }>
}

@Component({
  selector: 'my-admin-config-information',
  templateUrl: './admin-config-information.component.html',
  styleUrls: [ './admin-config-common.scss' ],
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
    HelpComponent,
    AdminSaveBarComponent
  ]
})
export class AdminConfigInformationComponent implements OnInit, CanComponentDeactivate {
  private customMarkup = inject(CustomMarkupService)
  private notifier = inject(Notifier)
  private instanceService = inject(InstanceService)
  private server = inject(ServerService)
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private adminConfigService = inject(AdminConfigService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  languageItems: SelectOptionsItem[] = []
  categoryItems: SelectOptionsItem[] = []

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
  private customConfig: CustomConfig

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    const data = this.route.snapshot.data as {
      languages: VideoConstant<string>[]
      categories: VideoConstant<number>[]
    }

    this.languageItems = data.languages.map(l => ({ label: l.label, id: l.id }))
    this.categoryItems = data.categories.map(l => ({ label: l.label, id: l.id }))

    this.serverConfig = this.server.getHTMLConfig()

    this.updateActorImages()
    this.buildForm()
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      admin: {
        email: ADMIN_EMAIL_VALIDATOR
      },
      contactForm: {
        enabled: null
      },
      instance: {
        name: INSTANCE_NAME_VALIDATOR,
        shortDescription: INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
        description: null,

        isNSFW: null,
        defaultNSFWPolicy: null,

        terms: null,
        codeOfConduct: null,

        creationReason: null,
        moderationInformation: null,
        administrator: null,
        maintenanceLifetime: null,
        businessModel: null,

        hardwareInformation: null,

        categories: null,
        languages: null,

        serverCountry: null,
        support: {
          text: null
        },
        social: {
          externalLink: URL_VALIDATOR,
          mastodonLink: URL_VALIDATOR,
          blueskyLink: URL_VALIDATOR
        }
      }
    }

    const defaultValues: FormDefaultTyped<Form> = this.customConfig

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
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

  save () {
    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`Information updated.`
    })
  }
}
