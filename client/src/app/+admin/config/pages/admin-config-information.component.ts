import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { CanComponentDeactivate, ServerService } from '@app/core'
import { URL_VALIDATOR } from '@app/shared/form-validators/common-validators'
import {
  ADMIN_EMAIL_VALIDATOR,
  INSTANCE_NAME_VALIDATOR,
  INSTANCE_SHORT_DESCRIPTION_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgument,
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { FormReactiveErrors, FormReactiveMessages, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { FormValidatorService } from '@app/shared/shared-forms/form-validator.service'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { SelectRadioComponent } from '@app/shared/shared-forms/select/select-radio.component'
import { getCompleteLocale, I18N_LOCALES } from '@peertube/peertube-core-utils'
import {
  ActorImage,
  ConstantLabel,
  CustomConfig,
  INSTANCE_TRANSLATABLE_FIELDS,
  InstanceTranslatableField,
  InstanceTranslation,
  NSFWPolicyType
} from '@peertube/peertube-models'
import { SelectOptionsItem } from '@pt-types'
import merge from 'lodash-es/merge'
import { distinctUntilChanged, map, Subscription } from 'rxjs'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCheckboxComponent } from '../../../shared/shared-forms/select/select-checkbox.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type TranslationForm = { language: FormControl<string> } & { [K in InstanceTranslatableField]: FormControl<string> }

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
  changeDetection: ChangeDetectionStrategy.Eager,
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
    SelectOptionsComponent,
    ButtonComponent
  ]
})
export class AdminConfigInformationComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private customMarkup = inject(CustomMarkupService)
  private server = inject(ServerService)
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private formValidatorService = inject(FormValidatorService)
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

  translationsArray: FormArray<FormGroup<TranslationForm>>
  translationItems: SelectOptionsItem[] = []
  newTranslationItems: SelectOptionsItem[] = []
  editedTranslationLanguage: string
  newTranslationLanguage: string

  // Short description and description have a specific UI
  translationMarkdownFields: { id: InstanceTranslatableField, label: string }[] = [
    { id: 'terms', label: $localize`Terms` },
    { id: 'codeOfConduct', label: $localize`Code of conduct` },
    { id: 'moderationInformation', label: $localize`Moderation information` },
    { id: 'administrator', label: $localize`Who is behind the instance?` },
    { id: 'creationReason', label: $localize`Why did you create this instance?` },
    { id: 'maintenanceLifetime', label: $localize`How long do you plan to maintain this instance?` },
    { id: 'businessModel', label: $localize`How will you finance the PeerTube server?` },
    { id: 'hardwareInformation', label: $localize`What server/hardware does the instance run on?` },
    { id: 'supportText', label: $localize`Support text` }
  ]

  private customConfig: CustomConfig
  private customConfigSub: Subscription
  private translationsStatusSub: Subscription

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    const data = this.route.snapshot.data as {
      languages: ConstantLabel<string>[]
      categories: ConstantLabel<number>[]
    }

    this.languageItems = data.languages.map(l => ({ label: l.label, id: l.id }))
    this.categoryItems = data.categories.map(l => ({ label: l.label, id: l.id }))
    this.defaultLanguageItems = Object.entries(I18N_LOCALES).map(([ id, label ]) => ({ label, id }))

    this.buildForm()

    this.customConfigSub = this.adminConfigService.getCustomConfigReloadedObs()
      .subscribe(customConfig => {
        this.customConfig = customConfig

        this.resetTranslations(this.customConfig.instance.translations)
        this.form.patchValue(this.customConfig)
      })
  }

  ngOnDestroy () {
    if (this.customConfigSub) this.customConfigSub.unsubscribe()
    if (this.translationsStatusSub) this.translationsStatusSub.unsubscribe()
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

    this.translationsArray = new FormArray<FormGroup<TranslationForm>>([])
    ;(this.form.controls.instance as FormGroup).addControl('translations', this.translationsArray)

    // Only the edited translation is displayed: flag the other ones that have errors
    this.translationsStatusSub = this.translationsArray.statusChanges
      .pipe(
        map(() => this.translationsArray.controls.filter(c => c.invalid).map(c => c.value.language).join()),
        distinctUntilChanged()
      )
      .subscribe(() => this.updateTranslationItems())

    this.resetTranslations(this.customConfig.instance.translations)
  }

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }

  // ---------------------------------------------------------------------------

  addTranslation () {
    const language = this.newTranslationLanguage
    if (!language) return

    this.addTranslationControl({ language })
    this.translationsArray.markAsDirty()

    this.editedTranslationLanguage = language
    this.newTranslationLanguage = undefined

    this.updateTranslationItems()
  }

  removeEditedTranslation () {
    const index = this.translationsArray.controls.findIndex(c => c.value.language === this.editedTranslationLanguage)
    if (index === -1) return

    this.formValidatorService.removeControlFromFormArray({
      controlName: 'translations',
      formArray: this.translationsArray,
      formErrors: this.getInstanceFormErrors(),
      validationMessages: this.validationMessages.instance,
      index
    })
    this.translationsArray.markAsDirty()

    this.editedTranslationLanguage = this.translationsArray.at(0)?.value.language

    this.updateTranslationItems()
  }

  getTranslationFormErrors (index: number) {
    return (this.getInstanceFormErrors().translations as FormReactiveErrors[])[index]
  }

  private resetTranslations (translations: InstanceTranslation[]) {
    this.translationsArray.clear()

    this.getInstanceFormErrors().translations = []
    ;(this.validationMessages.instance as FormReactiveMessages).translations = []

    for (const translation of translations) {
      this.addTranslationControl(translation)
    }

    this.editedTranslationLanguage = translations[0]?.language
    this.updateTranslationItems()
  }

  private addTranslationControl (translation: Partial<InstanceTranslation>) {
    const formToBuild: BuildFormArgument = { language: null }

    for (const field of INSTANCE_TRANSLATABLE_FIELDS) {
      formToBuild[field] = null
    }

    formToBuild.shortDescription = INSTANCE_SHORT_DESCRIPTION_VALIDATOR

    this.formValidatorService.addControlInFormArray({
      controlName: 'translations',
      formArray: this.translationsArray,
      formErrors: this.getInstanceFormErrors(),
      validationMessages: this.validationMessages.instance,
      formToBuild,
      defaultValues: translation
    })
  }

  private updateTranslationItems () {
    const languages = this.translationsArray.controls.map(c => c.value.language)
    const usedLanguages = new Set(languages.map(l => getCompleteLocale(l)))

    this.translationItems = this.translationsArray.controls.map(c => {
      const language = c.value.language
      const label = I18N_LOCALES[getCompleteLocale(language) as keyof typeof I18N_LOCALES] ?? language

      return { id: language, label: c.invalid ? $localize`${label} (has errors)` : label }
    })
    this.newTranslationItems = this.defaultLanguageItems.filter(i => !usedLanguages.has(i.id + ''))
  }

  private getInstanceFormErrors () {
    return this.formErrors.instance as FormReactiveErrors
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
