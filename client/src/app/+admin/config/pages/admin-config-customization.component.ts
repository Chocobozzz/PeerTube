import { CommonModule } from '@angular/common'
import { Component, inject, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValueChangeEvent } from '@angular/forms'
import { ActivatedRoute, RouterModule } from '@angular/router'
import { CanComponentDeactivate, ServerService, ThemeService } from '@app/core'
import { BuildFormArgumentTyped, FormDefaultTyped, FormReactiveMessagesTyped } from '@app/shared/form-validators/form-validator.model'
import { FormReactiveErrorsTyped, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { CustomConfig } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { capitalizeFirstLetter } from '@root-helpers/string'
import { ColorPaletteThemeConfig, ThemeCustomizationKey } from '@root-helpers/theme-manager'
import { formatHEX, parse } from 'color-bits'
import debug from 'debug'
import { ColorPickerModule } from 'primeng/colorpicker'
import { debounceTime } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { AdminConfigService } from '../shared/admin-config.service'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

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
}

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
    ColorPickerModule,
    AlertComponent,
    SelectOptionsComponent,
    HelpComponent,
    PeertubeCheckboxComponent
  ]
})
export class AdminConfigCustomizationComponent implements OnInit, CanComponentDeactivate {
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
    type: 'color' | 'pixels'
  }[] = []

  availableThemes: SelectOptionsItem[]

  private customizationResetFields = new Set<ThemeCustomizationKey>()
  private customConfig: CustomConfig

  private readonly formFieldsObject: Record<ThemeCustomizationKey, { label: string, description?: string, type: 'color' | 'pixels' }> = {
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
    menuBorderRadius: { label: $localize`Menu border radius`, type: 'pixels' },
    headerForegroundColor: { label: $localize`Header foreground color`, type: 'color' },
    headerBackgroundColor: { label: $localize`Header background color`, type: 'color' },
    inputBorderRadius: { label: $localize`Input border radius`, type: 'pixels' }
  }

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    this.availableThemes = [
      this.themeService.getDefaultThemeItem(),

      ...this.themeService.buildAvailableThemes()
    ]

    this.buildForm()
    this.subscribeToCustomizationChanges()
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
        name
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
      instance: {
        customizations: {
          css: null,
          javascript: null
        }
      },
      theme: {
        default: null,
        customization: {
          primaryColor: null,
          foregroundColor: null,
          backgroundColor: null,
          backgroundSecondaryColor: null,
          menuForegroundColor: null,
          menuBackgroundColor: null,
          menuBorderRadius: null,
          headerForegroundColor: null,
          headerBackgroundColor: null,
          inputBorderRadius: null
        }
      }
    }

    const defaultValues: FormDefaultTyped<Form> = {
      ...this.customConfig,

      theme: {
        default: this.customConfig.theme.default,
        customization: this.getDefaultCustomization()
      }
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

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

  private getDefaultCustomization () {
    const config = this.customConfig.theme.customization

    return objectKeysTyped(this.formFieldsObject).reduce((acc, field) => {
      acc[field] = config[field]
        ? this.formatCustomizationFieldForForm(field, config[field])
        : this.formatCustomizationFieldForForm(field, this.themeService.getCSSConfigValue(field))

      return acc
    }, {} as Record<ThemeCustomizationKey, string>)
  }

  isCustomizationFieldNumber (field: ThemeCustomizationKey) {
    return this.isNumber(this.getCustomizationControl(field).value)
  }

  private isNumber (value: string | number) {
    return typeof value === 'number' || /^\d+$/.test(value)
  }

  // ---------------------------------------------------------------------------

  private formatCustomizationFieldForForm (field: ThemeCustomizationKey, value: string) {
    if (this.formFieldsObject[field].type === 'pixels') {
      return this.formatPixelsForForm(value)
    }

    if (this.formFieldsObject[field].type === 'color') {
      return this.formatColorForForm(value)
    }

    return value
  }

  private formatPixelsForForm (value: string) {
    if (typeof value === 'number') return value + ''
    if (typeof value !== 'string') return null

    const result = parseInt(value.replace(/px$/, ''))

    if (isNaN(result)) return null

    return result + ''
  }

  private formatColorForForm (value: string) {
    if (!value) return null

    try {
      return formatHEX(parse(value))
    } catch (err) {
      logger.warn(`Error parsing color value "${value}"`, err)

      return null
    }
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

    if (this.formFieldsObject[field].type === 'pixels' && this.isNumber(value)) {
      value = value + 'px'
    }

    return value
  }
}
