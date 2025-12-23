import { CommonModule } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValueChangeEvent } from '@angular/forms'
import { ActivatedRoute, RouterModule } from '@angular/router'
import { CanComponentDeactivate, ServerService, ThemeService } from '@app/core'
import { HEX_COLOR_CODE_VALIDATOR } from '@app/shared/form-validators/common-validators'
import { BuildFormArgumentTyped, FormDefaultTyped, FormReactiveMessagesTyped } from '@app/shared/form-validators/form-validator.model'
import { FormReactiveErrorsTyped, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { PeertubeColorPickerComponent } from '@app/shared/shared-forms/peertube-color-picker.component'
import { SelectCustomValueComponent } from '@app/shared/shared-forms/select/select-custom-value.component'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { CustomConfig, PlayerTheme } from '@peertube/peertube-models'
import { capitalizeFirstLetter } from '@root-helpers/string'
import { ColorPaletteThemeConfig, ThemeCustomizationKey } from '@root-helpers/theme-manager'
import debug from 'debug'
import { debounceTime, Subscription } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'
import { SelectPlayerThemeComponent } from '@app/shared/shared-forms/select/select-player-theme.component'

const debugLogger = debug('peertube:config')

type Form = {
  instance: FormGroup<{
    customizations: FormGroup<{
      css: FormControl<string>
      javascript: FormControl<string>
    }>
  }>

  client: FormGroup<{
    videos: FormGroup<{
      miniature: FormGroup<{
        preferAuthorDisplayName: FormControl<boolean>
      }>
    }>
  }>

  email: FormGroup<{
    subject: FormGroup<{
      prefix: FormControl<string>
    }>

    body: FormGroup<{
      signature: FormControl<string>
    }>
  }>

  theme: FormGroup<{
    default: FormControl<string>

    customization: FormGroup<{
      primaryColor: FormControl<string>
      foregroundColor: FormControl<string>
      backgroundColor: FormControl<string>
      backgroundSecondaryColor: FormControl<string>
      menuForegroundColor: FormControl<string>
      menuBackgroundColor: FormControl<string>
      menuBorderRadius: FormControl<string>
      headerForegroundColor: FormControl<string>
      headerBackgroundColor: FormControl<string>
      inputBorderRadius: FormControl<string>
    }>
  }>

  defaults: FormGroup<{
    player: FormGroup<{
      theme: FormControl<PlayerTheme>
    }>
  }>
}

type FieldType = 'color' | 'radius'

@Component({
  selector: 'my-admin-config-customization',
  templateUrl: './admin-config-customization.component.html',
  styleUrls: [ './admin-config-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ReactiveFormsModule,
    AdminSaveBarComponent,
    PeertubeColorPickerComponent,
    AlertComponent,
    SelectOptionsComponent,
    HelpComponent,
    PeertubeCheckboxComponent,
    SelectCustomValueComponent,
    SelectPlayerThemeComponent
  ]
})
export class AdminConfigCustomizationComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private formReactiveService = inject(FormReactiveService)
  private adminConfigService = inject(AdminConfigService)
  private serverService = inject(ServerService)
  private themeService = inject(ThemeService)
  private route = inject(ActivatedRoute)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  customizationFormFields: {
    label: string
    inputId: string
    name: ThemeCustomizationKey
    description?: string
    type: FieldType
    items?: SelectOptionsItem[]
  }[] = []

  availableThemes: SelectOptionsItem[]
  availablePlayerThemes: SelectOptionsItem<PlayerTheme>[] = []

  private customizationResetFields = new Set<ThemeCustomizationKey>()
  private customConfig: CustomConfig

  private customConfigSub: Subscription

  private readonly formFieldsObject: Record<
    ThemeCustomizationKey,
    { label: string, description?: string, type: FieldType, items?: SelectOptionsItem[] }
  > = {
    primaryColor: { label: $localize`Primary color`, type: 'color' },
    foregroundColor: { label: $localize`Foreground color`, type: 'color' },
    backgroundColor: { label: $localize`Background color`, type: 'color' },
    backgroundSecondaryColor: {
      label: $localize`Secondary background color`,
      description: $localize`Used as a background for inputs, overlays...`,
      type: 'color'
    },
    menuForegroundColor: { label: $localize`Menu foreground color`, type: 'color' },
    menuBackgroundColor: { label: $localize`Menu background color`, type: 'color' },

    menuBorderRadius: {
      label: $localize`Menu rounding`,
      type: 'radius',
      items: [
        { id: '0', label: $localize`Not rounded` },
        { id: '6px', label: $localize`Slightly rounded` },
        { id: '14px', label: $localize`Moderately rounded (default)` },
        { id: '60px', label: $localize`Rounded` }
      ]
    },

    headerForegroundColor: { label: $localize`Header foreground color`, type: 'color' },
    headerBackgroundColor: { label: $localize`Header background color`, type: 'color' },

    inputBorderRadius: {
      label: $localize`Input rounding`,
      type: 'radius',
      items: [
        { id: '0', label: $localize`Not rounded` },
        { id: '4px', label: $localize`Slightly rounded (default)` },
        { id: '10px', label: $localize`Moderately rounded` },
        { id: '20px', label: $localize`Rounded` }
      ]
    }
  }

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    this.availableThemes = [
      this.themeService.getDefaultThemeItem(),

      ...this.themeService.buildAvailableThemes()
    ]

    this.availablePlayerThemes = [
      { id: 'galaxy', label: $localize`Galaxy`, description: $localize`Original theme` },
      { id: 'lucide', label: $localize`Lucide`, description: $localize`A clean and modern theme` }
    ]

    this.buildForm()
    this.subscribeToCustomizationChanges()

    this.customConfigSub = this.adminConfigService.getCustomConfigReloadedObs()
      .subscribe(customConfig => {
        this.customConfig = customConfig

        this.form.patchValue(this.getDefaultFormValues(), { emitEvent: false })
        this.form.setErrors(this.form.errors)
      })
  }

  ngOnDestroy () {
    if (this.customConfigSub) this.customConfigSub.unsubscribe()
  }

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  private subscribeToCustomizationChanges () {
    let currentAnimationFrame: number

    this.form.get('theme.customization').valueChanges.pipe(debounceTime(250)).subscribe(formValues => {
      if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame)
        currentAnimationFrame = null
      }

      currentAnimationFrame = requestAnimationFrame(() => {
        this.themeService.updateColorPalette({
          ...this.customConfig.theme,

          customization: this.buildNewCustomization(formValues)
        })
      })
    })

    for (const [ key, control ] of Object.entries((this.form.get('theme.customization') as FormGroup).controls)) {
      control.events.subscribe(event => {
        if (event instanceof ValueChangeEvent) {
          debugLogger(`Deleting "${key}" from reset fields`)

          this.customizationResetFields.delete(key as ThemeCustomizationKey)
        }
      })
    }
  }

  private buildForm () {
    for (const [ untypedName, info ] of Object.entries(this.formFieldsObject)) {
      const name = untypedName as ThemeCustomizationKey

      this.customizationFormFields.push({
        label: info.label,
        type: info.type,
        inputId: `themeCustomization${capitalizeFirstLetter(name)}`,
        name,
        items: info.items
      })

      if (!this.customConfig.theme.customization[name]) {
        this.customizationResetFields.add(name)
      }
    }

    const obj: BuildFormArgumentTyped<Form> = {
      client: {
        videos: {
          miniature: {
            preferAuthorDisplayName: null
          }
        }
      },
      email: {
        subject: {
          prefix: null
        },
        body: {
          signature: null
        }
      },
      instance: {
        customizations: {
          css: null,
          javascript: null
        }
      },
      theme: {
        default: null,
        customization: {
          primaryColor: HEX_COLOR_CODE_VALIDATOR,
          foregroundColor: HEX_COLOR_CODE_VALIDATOR,
          backgroundColor: HEX_COLOR_CODE_VALIDATOR,
          backgroundSecondaryColor: HEX_COLOR_CODE_VALIDATOR,
          menuForegroundColor: HEX_COLOR_CODE_VALIDATOR,
          menuBackgroundColor: HEX_COLOR_CODE_VALIDATOR,
          menuBorderRadius: null,
          headerForegroundColor: HEX_COLOR_CODE_VALIDATOR,
          headerBackgroundColor: HEX_COLOR_CODE_VALIDATOR,
          inputBorderRadius: null
        }
      },
      defaults: {
        player: {
          theme: null
        }
      }
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, this.getDefaultFormValues())

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  getCurrentThemeName () {
    return this.themeService.getCurrentThemeName()
  }

  getCurrentThemeLabel () {
    return this.availableThemes.find(t => t.id === this.themeService.getCurrentThemeName())?.label
  }

  getDefaultThemeName () {
    return this.serverService.getHTMLConfig().theme.default
  }

  getDefaultThemeLabel () {
    return this.availableThemes.find(t => t.id === this.getDefaultThemeName())?.label
  }

  hasDefaultCustomizationValue (field: ThemeCustomizationKey) {
    return this.customizationResetFields.has(field)
  }

  resetCustomizationField (field: ThemeCustomizationKey) {
    this.customizationResetFields.add(field)

    this.themeService.updateColorPalette({
      ...this.customConfig.theme,

      customization: this.buildNewCustomization(this.form.get('theme.customization').value)
    })

    const value = this.formatCustomizationFieldForForm(field, this.themeService.getCSSConfigValue(field))
    const control = this.getCustomizationControl(field)

    control.patchValue(value, { emitEvent: false })
    control.markAsDirty()
    control.setErrors(control.errors)
  }

  save () {
    const formValues = this.form.value
    formValues.theme.customization = this.buildNewCustomization(formValues.theme.customization)

    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`Platform customization updated.`
    })
  }

  private getCustomizationControl (field: ThemeCustomizationKey) {
    return this.form.get('theme.customization').get(field)
  }

  private getDefaultFormValues (): FormDefaultTyped<Form> {
    return {
      ...this.customConfig,

      theme: {
        default: this.customConfig.theme.default,
        customization: this.getDefaultCustomization()
      }
    }
  }

  private getDefaultCustomization () {
    const config = this.customConfig.theme.customization

    return objectKeysTyped(this.formFieldsObject).reduce((acc, field) => {
      acc[field] = config[field]
        ? this.formatCustomizationFieldForForm(field, config[field])
        : this.formatCustomizationFieldForForm(field, this.themeService.getCSSConfigValue(field))

      return acc
    }, {} as Record<ThemeCustomizationKey, string>)
  }

  // ---------------------------------------------------------------------------

  private formatCustomizationFieldForForm (field: ThemeCustomizationKey, value: string) {
    if (this.formFieldsObject[field].type === 'color') {
      return this.themeService.formatColorForForm(value)
    }

    return value
  }

  // ---------------------------------------------------------------------------

  private buildNewCustomization (formValues: any) {
    return objectKeysTyped(this.customConfig.theme.customization).reduce(
      (acc: ColorPaletteThemeConfig['customization'], field) => {
        acc[field] = this.formatCustomizationFieldForTheme(field, formValues[field])

        return acc
      },
      {} as ColorPaletteThemeConfig['customization']
    )
  }

  private formatCustomizationFieldForTheme (field: ThemeCustomizationKey, value: string) {
    if (this.customizationResetFields.has(field)) return null

    return value
  }
}
