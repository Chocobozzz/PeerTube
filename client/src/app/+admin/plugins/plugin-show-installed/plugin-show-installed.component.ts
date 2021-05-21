import { Subscription } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { HooksService, Notifier, PluginService } from '@app/core'
import { BuildFormArgument } from '@app/shared/form-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { PeerTubePlugin, RegisterServerSettingOptions } from '@shared/models'
import { PluginApiService } from '../shared/plugin-api.service'

@Component({
  selector: 'my-plugin-show-installed',
  templateUrl: './plugin-show-installed.component.html',
  styleUrls: [ './plugin-show-installed.component.scss' ]
})
export class PluginShowInstalledComponent extends FormReactive implements OnInit, OnDestroy {
  plugin: PeerTubePlugin
  registeredSettings: RegisterServerSettingOptions[] = []
  pluginTypeLabel: string

  private sub: Subscription
  private npmName: string

  constructor (
    protected formValidatorService: FormValidatorService,
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
        .subscribe(
          () => {
            this.notifier.success($localize`Settings updated.`)
          },

          err => this.notifier.error(err.message)
        )
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
        .subscribe(
          async ({ plugin, registeredSettings }) => {
            this.plugin = plugin

            this.registeredSettings = await this.translateSettings(registeredSettings)

            this.pluginTypeLabel = this.pluginAPIService.getPluginTypeLabel(this.plugin.type)

            this.buildSettingsForm()
          },

          err => this.notifier.error(err.message)
        )
  }

  private buildSettingsForm () {
    const buildOptions: BuildFormArgument = {}
    const settingsValues: any = {}

    for (const setting of this.registeredSettings) {
      buildOptions[ setting.name ] = null
      settingsValues[ setting.name ] = this.getSetting(setting.name)
    }

    this.buildForm(buildOptions)

    this.form.patchValue(settingsValues)

    setTimeout(() => this.hooks.runAction('action:admin-plugin-settings.init', 'admin-plugin', { npmName: this.npmName }))
  }

  private getSetting (name: string) {
    const settings = this.plugin.settings

    if (settings && settings[name] !== undefined) return settings[name]

    const registered = this.registeredSettings.find(r => r.name === name)

    return registered.default
  }

  private async translateSettings (settings: RegisterServerSettingOptions[]) {
    for (const setting of settings) {
      for (const key of [ 'label', 'html', 'descriptionHTML' ]) {
        if (setting[key]) setting[key] = await this.pluginService.translateBy(this.npmName, setting[key])
      }

      if (Array.isArray(setting.options)) {
        const newOptions = []

        for (const o of setting.options) {
          newOptions.push({
            value: o.value,
            label: await this.pluginService.translateBy(this.npmName, o.label)
          })
        }

        setting.options = newOptions
      }
    }

    return settings
  }

}
