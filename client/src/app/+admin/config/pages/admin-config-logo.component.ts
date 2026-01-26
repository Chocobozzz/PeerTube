import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import {
  BuildFormArgumentTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { CustomConfig, LogoType } from '@peertube/peertube-models'
import { of, Subscription, switchMap, tap } from 'rxjs'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { PreviewUploadComponent } from '../../../shared/shared-forms/preview-upload.component'
import { InstanceLogoService } from '../../../shared/shared-instance/instance-logo.service'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type Form = {
  hideInstanceName: FormControl<boolean>

  avatar: FormControl<Blob>
  banner: FormControl<Blob>
  favicon: FormControl<Blob>
  'header-square': FormControl<Blob>
  'header-wide': FormControl<Blob>
  opengraph: FormControl<Blob>
}

@Component({
  selector: 'my-admin-config-logo',
  templateUrl: './admin-config-logo.component.html',
  styleUrls: [ './admin-config-logo.component.scss', './admin-config-common.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AdminSaveBarComponent,
    PreviewUploadComponent,
    PeertubeCheckboxComponent
  ]
})
export class AdminConfigLogoComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private notifier = inject(Notifier)
  private logoService = inject(InstanceLogoService)
  private server = inject(ServerService)
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private serverService = inject(ServerService)
  private adminConfigService = inject(AdminConfigService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  private customConfig: CustomConfig
  private customConfigSub: Subscription

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    this.buildForm()

    this.customConfigSub = this.adminConfigService.getCustomConfigReloadedObs()
      .subscribe(customConfig => {
        this.customConfig = customConfig

        this.form.patchValue({ hideInstanceName: customConfig.client.header.hideInstanceName })
      })
  }

  ngOnDestroy () {
    if (this.customConfigSub) this.customConfigSub.unsubscribe()
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      'hideInstanceName': null,

      'avatar': null,
      'banner': null,
      'favicon': null,
      'header-square': null,
      'header-wide': null,
      'opengraph': null
    }

    const defaultValues = {
      hideInstanceName: this.customConfig.client.header.hideInstanceName,

      ...this.route.snapshot.data.logos
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

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  save () {
    this.adminConfigService.updateCustomConfig({
      client: {
        header: {
          hideInstanceName: this.form.value.hideInstanceName
        }
      }
    }).pipe(
      switchMap(() => this.serverService.resetConfig()),
      tap(newConfig => Object.assign(this.customConfig, newConfig)),
      switchMap(() => this.buildSaveAvatar()),
      switchMap(() => this.saveBanner()),
      switchMap(() => this.saveLogo('favicon')),
      switchMap(() => this.saveLogo('header-square')),
      switchMap(() => this.saveLogo('header-wide')),
      switchMap(() => this.saveLogo('opengraph')),
      switchMap(() => this.serverService.resetConfig()),
      switchMap(() => this.logoService.getAllLogos())
    ).subscribe({
      next: logos => {
        this.notifier.success($localize`Logos updated`)

        this.form.patchValue(logos)
        this.form.markAsPristine()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  private buildSaveAvatar () {
    if (this.form.controls.avatar.pristine) return of(true)

    const avatar = this.form.value.avatar

    return avatar
      ? this.logoService.updateAvatar(avatar)
      : this.logoService.deleteAvatar()
  }

  private saveBanner () {
    if (this.form.controls.banner.pristine) return of(true)

    const banner = this.form.value.banner

    return banner
      ? this.logoService.updateBanner(banner)
      : this.logoService.deleteBanner()
  }

  private saveLogo (type: LogoType) {
    const control = this.form.get(type)
    if (control.pristine) return of(true)

    const logo = control.value

    return logo
      ? this.logoService.updateLogo(logo, type)
      : this.logoService.deleteLogo(type)
  }
}
