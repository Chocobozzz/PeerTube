import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { ServerService } from '@app/core/server/server.service'
import { FormReactive, USER_VIDEO_QUOTA } from '@app/shared'
import {
  ADMIN_EMAIL,
  CACHE_PREVIEWS_SIZE,
  INSTANCE_NAME,
  SIGNUP_LIMIT,
  TRANSCODING_THREADS
} from '@app/shared/forms/form-validators/custom-config'
import { NotificationsService } from 'angular2-notifications'
import { CustomConfig } from '../../../../../../shared/models/config/custom-config.model'

@Component({
  selector: 'my-edit-custom-config',
  templateUrl: './edit-custom-config.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditCustomConfigComponent extends FormReactive implements OnInit {
  customConfig: CustomConfig
  resolutions = [ '240p', '360p', '480p', '720p', '1080p' ]

  videoQuotaOptions = [
    { value: -1, label: 'Unlimited' },
    { value: 0, label: '0' },
    { value: 100 * 1024 * 1024, label: '100MB' },
    { value: 500 * 1024 * 1024, label: '500MB' },
    { value: 1024 * 1024 * 1024, label: '1GB' },
    { value: 5 * 1024 * 1024 * 1024, label: '5GB' },
    { value: 20 * 1024 * 1024 * 1024, label: '20GB' },
    { value: 50 * 1024 * 1024 * 1024, label: '50GB' }
  ]
  transcodingThreadOptions = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 4, label: '4' },
    { value: 8, label: '8' }
  ]

  form: FormGroup
  formErrors = {
    instanceName: '',
    instanceDescription: '',
    instanceTerms: '',
    cachePreviewsSize: '',
    signupLimit: '',
    adminEmail: '',
    userVideoQuota: '',
    transcodingThreads: ''
  }
  validationMessages = {
    instanceName: INSTANCE_NAME.MESSAGES,
    cachePreviewsSize: CACHE_PREVIEWS_SIZE.MESSAGES,
    signupLimit: SIGNUP_LIMIT.MESSAGES,
    adminEmail: ADMIN_EMAIL.MESSAGES,
    userVideoQuota: USER_VIDEO_QUOTA.MESSAGES
  }

  constructor (
    private formBuilder: FormBuilder,
    private router: Router,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private serverService: ServerService
  ) {
    super()
  }

  getResolutionKey (resolution: string) {
    return 'transcodingResolution' + resolution
  }

  buildForm () {
    const formGroupData = {
      instanceName: [ '', INSTANCE_NAME.VALIDATORS ],
      instanceDescription: [ '' ],
      instanceTerms: [ '' ],
      cachePreviewsSize: [ '', CACHE_PREVIEWS_SIZE.VALIDATORS ],
      signupEnabled: [ ],
      signupLimit: [ '', SIGNUP_LIMIT.VALIDATORS ],
      adminEmail: [ '', ADMIN_EMAIL.VALIDATORS ],
      userVideoQuota: [ '', USER_VIDEO_QUOTA.VALIDATORS ],
      transcodingThreads: [ '', TRANSCODING_THREADS.VALIDATORS ],
      transcodingEnabled: [ ]
    }

    for (const resolution of this.resolutions) {
      const key = this.getResolutionKey(resolution)
      formGroupData[key] = [ false ]
    }

    this.form = this.formBuilder.group(formGroupData)

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    this.configService.getCustomConfig()
      .subscribe(
        res => {
          this.customConfig = res

          this.updateForm()
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  isTranscodingEnabled () {
    return this.form.value['transcodingEnabled'] === true
  }

  isSignupEnabled () {
    return this.form.value['signupEnabled'] === true
  }

  formValidated () {
    const data = {
      instance: {
        name: this.form.value['instanceName'],
        description: this.form.value['instanceDescription'],
        terms: this.form.value['instanceTerms']
      },
      cache: {
        previews: {
          size: this.form.value['cachePreviewsSize']
        }
      },
      signup: {
        enabled: this.form.value['signupEnabled'],
        limit: this.form.value['signupLimit']
      },
      admin: {
        email: this.form.value['adminEmail']
      },
      user: {
        videoQuota: this.form.value['userVideoQuota']
      },
      transcoding: {
        enabled: this.form.value['transcodingEnabled'],
        threads: this.form.value['transcodingThreads'],
        resolutions: {
          '240p': this.form.value[this.getResolutionKey('240p')],
          '360p': this.form.value[this.getResolutionKey('360p')],
          '480p': this.form.value[this.getResolutionKey('480p')],
          '720p': this.form.value[this.getResolutionKey('720p')],
          '1080p': this.form.value[this.getResolutionKey('1080p')]
        }
      }
    }

    this.configService.updateCustomConfig(data)
      .subscribe(
        res => {
          this.customConfig = res

          // Reload general configuration
          this.serverService.loadConfig()

          this.updateForm()

          this.notificationsService.success('Success', 'Configuration updated.')
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  private updateForm () {
    const data = {
      instanceName: this.customConfig.instance.name,
      instanceDescription: this.customConfig.instance.description,
      instanceTerms: this.customConfig.instance.terms,
      cachePreviewsSize: this.customConfig.cache.previews.size,
      signupEnabled: this.customConfig.signup.enabled,
      signupLimit: this.customConfig.signup.limit,
      adminEmail: this.customConfig.admin.email,
      userVideoQuota: this.customConfig.user.videoQuota,
      transcodingThreads: this.customConfig.transcoding.threads,
      transcodingEnabled: this.customConfig.transcoding.enabled
    }

    for (const resolution of this.resolutions) {
      const key = this.getResolutionKey(resolution)
      data[key] = this.customConfig.transcoding.resolutions[resolution]
    }

    this.form.patchValue(data)
  }

}
