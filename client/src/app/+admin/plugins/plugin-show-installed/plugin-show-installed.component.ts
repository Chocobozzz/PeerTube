import { Subscription } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { HooksService, Notifier, PluginService } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeerTubePlugin, RegisterServerSettingOptions } from '@peertube/peertube-models'
import { PluginApiService } from '../shared/plugin-api.service'
import { DynamicFormFieldComponent } from '../../../shared/shared-forms/dynamic-form-field.component'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NgIf, NgFor } from '@angular/common'
import { BuildFormArgument } from '@app/shared/form-validators/form-validator.model'

@Component({
  selector: 'my-plugin-show-installed',
  templateUrl: './plugin-show-installed.component.html',
  standalone: true,
  imports: [ NgIf, FormsModule, ReactiveFormsModule, NgFor, DynamicFormFieldComponent ]
})
export class PluginShowInstalledComponent extends FormReactive implements OnInit, OnDestroy {
  plugin: PeerTubePlugin
  registeredSettings: RegisterServerSettingOptions[] = []
  pluginTypeLabel: string

  private sub: Subscription
  private npmName: string

  constructor (
    protected formReactiveService: FormReactiveService,
    private pluginService: PluginService,
    private pluginAPIService: PluginApiService,
    private notifier: Notifier,
    private hooks: HooksService,
    private route: ActivatedRoute
  ) {
    super()
  }

  ngOnInit () {
    this.sub = this.route.params.subscribe(
      routeParams => {
        this.npmName = routeParams['npmName']

        this.loadPlugin(this.npmName)
      }
    )
  }

  ngOnDestroy () {
    if (this.sub) this.sub.unsubscribe()
  }

  formValidated () {
    const settings = this.form.value

    this.pluginAPIService.updatePluginSettings(this.plugin.name, this.plugin.type, settings)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Settings updated.`)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  hasRegisteredSettings () {
    return Array.isArray(this.registeredSettings) && this.registeredSettings.length !== 0
  }

  isSettingHidden (setting: RegisterServerSettingOptions) {
    const script = this.pluginService.getRegisteredSettingsScript(this.npmName)

    if (!script?.isSettingHidden) return false

    return script.isSettingHidden({ setting, formValues: this.form.value })
  }

  getWrapperId (setting: RegisterServerSettingOptions) {
    if (!setting.name) return

    return setting.name + '-wrapper'
  }

  private loadPlugin (npmName: string) {
    this.pluginAPIService.getPlugin(npmName)
        .pipe(switchMap(plugin => {
          return this.pluginAPIService.getPluginRegisteredSettings(plugin.name, plugin.type)
            .pipe(map(data => ({ plugin, registeredSettings: data.registeredSettings })))
        }))
        .subscribe({
          next: async ({ plugin, registeredSettings }) => {
            this.plugin = plugin

            this.registeredSettings = await this.translateSettings(registeredSettings)

            this.pluginTypeLabel = this.pluginAPIService.getPluginTypeLabel(this.plugin.type)

            this.buildSettingsForm()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  private buildSettingsForm () {
    const buildOptions: BuildFormArgument = {}
    const settingsValues: any = {}

    for (const setting of this.registeredSettings) {
      buildOptions[setting.name] = null
      settingsValues[setting.name] = this.getSetting(setting.name)
    }

    this.buildForm(buildOptions)

    this.form.patchValue(settingsValues)

    this.hooks.runAction('action:admin-plugin-settings.init', 'admin-plugin', { npmName: this.npmName })
  }

  private getSetting (name: string) {
    const settings = this.plugin.settings

    if (settings?.[name] !== undefined) return settings[name]

    const registered = this.registeredSettings.find(r => r.name === name)

    return registered.default
  }

  private async translateSettings (settings: RegisterServerSettingOptions[]) {
    for (const setting of settings) {
      await this.pluginService.translateSetting(this.npmName, setting)
    }

    return settings
  }
}
