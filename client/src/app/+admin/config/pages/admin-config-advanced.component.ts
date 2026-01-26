import { CommonModule } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { CanComponentDeactivate } from '@app/core'
import { CACHE_SIZE_VALIDATOR, SERVICES_TWITTER_USERNAME_VALIDATOR } from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { CustomConfig } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type Form = {
  services: FormGroup<{
    twitter: FormGroup<{
      username: FormControl<string>
    }>
  }>

  cache: FormGroup<{
    previews: FormGroup<{
      size: FormControl<number>
    }>
    captions: FormGroup<{
      size: FormControl<number>
    }>
    torrents: FormGroup<{
      size: FormControl<number>
    }>
    storyboards: FormGroup<{
      size: FormControl<number>
    }>
  }>
}

@Component({
  selector: 'my-admin-config-advanced',
  templateUrl: './admin-config-advanced.component.html',
  styleUrls: [ './admin-config-common.scss' ],
  imports: [ CommonModule, FormsModule, ReactiveFormsModule, AdminSaveBarComponent ]
})
export class AdminConfigAdvancedComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private adminConfigService = inject(AdminConfigService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  private customConfig: CustomConfig
  private customConfigSub: Subscription

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

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

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      services: {
        twitter: {
          username: SERVICES_TWITTER_USERNAME_VALIDATOR
        }
      },
      cache: {
        previews: {
          size: CACHE_SIZE_VALIDATOR
        },
        captions: {
          size: CACHE_SIZE_VALIDATOR
        },
        torrents: {
          size: CACHE_SIZE_VALIDATOR
        },
        storyboards: {
          size: CACHE_SIZE_VALIDATOR
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

  getCacheSize (type: 'captions' | 'previews' | 'torrents' | 'storyboards') {
    return this.form.value.cache[type].size
  }

  save () {
    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`Advanced configuration updated.`
    })
  }
}
