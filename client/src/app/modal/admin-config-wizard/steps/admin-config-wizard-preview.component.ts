import { CdkStepperModule } from '@angular/cdk/stepper'

import { booleanAttribute, Component, inject, input, numberAttribute, OnChanges, output, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { HtmlRendererService, PasswordConfirmationService, ServerService } from '@app/core'
import { AdminConfigService } from '@app/shared/shared-admin/admin-config.service'
import { PluginApiService } from '@app/shared/shared-admin/plugin-api.service'
import { CustomConfig } from '@peertube/peertube-models'
import merge from 'lodash-es/merge'
import { ColorPickerModule } from 'primeng/colorpicker'
import { concatMap, from, switchMap, toArray } from 'rxjs'
import { PartialDeep } from 'type-fest'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { FormEditInfo } from './admin-config-wizard-edit-info.component'
import { UsageType } from './usage-type/usage-type.model'
import { InstanceLogoService } from '@app/shared/shared-instance/instance-logo.service'

@Component({
  selector: 'my-admin-config-wizard-preview',
  templateUrl: './admin-config-wizard-preview.component.html',
  styleUrls: [ '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ColorPickerModule,
    CdkStepperModule,
    ButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [ AdminConfigService, PluginApiService, InstanceLogoService ]
})
export class AdminConfigWizardPreviewComponent implements OnChanges {
  private adminConfig = inject(AdminConfigService)
  private pluginAPI = inject(PluginApiService)
  private passwordConfirmation = inject(PasswordConfirmationService)
  private html = inject(HtmlRendererService)
  private server = inject(ServerService)
  private instanceLogo = inject(InstanceLogoService)

  readonly currentStep = input.required({ transform: numberAttribute })
  readonly totalSteps = input.required({ transform: numberAttribute })
  readonly usageType = input.required<UsageType>()
  readonly instanceInfo = input.required<FormEditInfo>()
  readonly dryRun = input.required({ transform: booleanAttribute })

  readonly back = output()
  readonly next = output()
  readonly hide = output()

  safeExplanations: string[] = []
  plugins: string[] = []
  config: PartialDeep<CustomConfig> = {}

  updating = false

  ngOnChanges () {
    if (this.usageType()) {
      this.safeExplanations = this.usageType()
        .getUnsafeExplanations()
        .map(e => this.html.toSimpleSafeHtml(e))

      this.config = merge(
        {
          instance: {
            name: this.instanceInfo().platformName,
            shortDescription: this.instanceInfo().shortDescription
          },
          theme: {
            customization: {
              primaryColor: this.instanceInfo().primaryColor
            }
          }
        } satisfies PartialDeep<CustomConfig>,
        this.usageType().getConfig()
      )

      this.plugins = this.usageType().getPlugins()
    }
  }

  async confirm () {
    if (this.dryRun()) {
      return this.next.emit()
    }

    let currentPassword: string

    if (this.plugins.length !== 0) {
      const res = await this.passwordConfirmation.askPassword({
        title: $localize`Install plugins`,
        message: $localize`The following plugins will be installed on your platform: ${this.plugins.join(', ')}.`
      })
      if (res.confirmed === false) return

      currentPassword = res.currentPassword
    }

    this.updating = true

    this.adminConfig.updateCustomConfig(this.config)
      .pipe(
        switchMap(() => {
          const avatar = this.instanceInfo().avatar
          if (avatar) return this.instanceLogo.updateAvatar(avatar)

          return this.instanceLogo.deleteAvatar()
        }),
        switchMap(() => this.server.resetConfig()),
        switchMap(() => {
          return from(this.plugins)
            .pipe(
              concatMap(plugin => this.pluginAPI.install(plugin, currentPassword)),
              toArray()
            )
        })
      ).subscribe({
        next: () => {
          this.updating = false

          this.next.emit()
        },

        error: err => {
          this.passwordConfirmation.handleError(err)
          this.updating = false
        }
      })
  }
}
