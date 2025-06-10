import { CommonModule } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { CanComponentDeactivate, ServerService } from '@app/core'
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
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { SelectRadioComponent } from '@app/shared/shared-forms/select/select-radio.component'
import { getCompleteLocale, I18N_LOCALES } from '@peertube/peertube-core-utils'
import { ActorImage, CustomConfig, NSFWPolicyType, VideoConstant } from '@peertube/peertube-models'
import merge from 'lodash-es/merge'
import { Subscription } from 'rxjs'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCheckboxComponent } from '../../../shared/shared-forms/select/select-checkbox.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
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
    defaultLanguage: FormControl<string>
    languages: FormControl<string[]>
    serverCountry: FormControl<string>

    support: FormGroup<{
      text: FormControl<string>
    }>

    social: FormGroup<{
      externalLink: FormControl<string>
      mastodonLink: FormControl<string>
      blueskyLink: FormControl<string>
      xLink: FormControl<string>
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
    SelectRadioComponent,
    CommonModule,
    CustomMarkupHelpComponent,
    MarkdownTextareaComponent,
    SelectCheckboxComponent,
    RouterLink,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    HelpComponent,
    AdminSaveBarComponent,
    SelectOptionsComponent
  ]
})
export class AdminConfigInformationComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private customMarkup = inject(CustomMarkupService)
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

  defaultLanguageItems: SelectOptionsItem[] = []

  private customConfig: CustomConfig
  private customConfigSub: Subscription

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
    this.defaultLanguageItems = Object.entries(I18N_LOCALES).map(([ id, label ]) => ({ label, id }))

    this.buildForm()

    this.customConfigSub = this.adminConfigService.getCustomConfigReloadedObs()
      .subscribe(customConfig => {
        this.customConfig = customConfig

        this.form.patchValue(this.customConfig)
      })
  }

  ngOnDestroy () {
    if (this.customConfigSub) this.customConfigSub.unsubscribe()
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

        defaultLanguage: null,

        categories: null,
        languages: null,

        serverCountry: null,
        support: {
          text: null
        },
        social: {
          externalLink: URL_VALIDATOR,
          mastodonLink: URL_VALIDATOR,
          blueskyLink: URL_VALIDATOR,
          xLink: URL_VALIDATOR
        }
      }
    }

    const defaultValues: FormDefaultTyped<Form> = merge(
      this.customConfig,
      {
        instance: {
          defaultLanguage: getCompleteLocale(this.customConfig.instance.defaultLanguage)
        }
      } satisfies FormDefaultTyped<Form>
    )

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

  save () {
    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`Information updated.`
    })
  }
}
