import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { ConfirmService } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import { CustomConfigValidatorsService, FormReactive, UserValidatorsService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { CustomConfig } from '../../../../../../shared/models/server/custom-config.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { BuildFormDefaultValues, FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

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
    { value: 0, label: 'Auto (via ffmpeg)' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 4, label: '4' },
    { value: 8, label: '8' }
  ]

  private oldCustomJavascript: string
  private oldCustomCSS: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private customConfigValidatorsService: CustomConfigValidatorsService,
    private userValidatorsService: UserValidatorsService,
    private router: Router,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private serverService: ServerService,
    private confirmService: ConfirmService,
    private i18n: I18n
  ) {
    super()
  }

  getResolutionKey (resolution: string) {
    return 'transcodingResolution' + resolution
  }

  ngOnInit () {
    const formGroupData = {
      instanceName: this.customConfigValidatorsService.INSTANCE_NAME,
      instanceShortDescription: this.customConfigValidatorsService.INSTANCE_SHORT_DESCRIPTION,
      instanceDescription: null,
      instanceTerms: null,
      instanceDefaultClientRoute: null,
      instanceDefaultNSFWPolicy: null,
      servicesTwitterUsername: this.customConfigValidatorsService.SERVICES_TWITTER_USERNAME,
      servicesTwitterWhitelisted: null,
      cachePreviewsSize: this.customConfigValidatorsService.CACHE_PREVIEWS_SIZE,
      cacheCaptionsSize: this.customConfigValidatorsService.CACHE_CAPTIONS_SIZE,
      signupEnabled: null,
      signupLimit: this.customConfigValidatorsService.SIGNUP_LIMIT,
      importVideosHttpEnabled: null,
      importVideosTorrentEnabled: null,
      adminEmail: this.customConfigValidatorsService.ADMIN_EMAIL,
      userVideoQuota: this.userValidatorsService.USER_VIDEO_QUOTA,
      transcodingThreads: this.customConfigValidatorsService.TRANSCODING_THREADS,
      transcodingEnabled: null,
      customizationJavascript: null,
      customizationCSS: null
    }

    const defaultValues: BuildFormDefaultValues = {}
    for (const resolution of this.resolutions) {
      const key = this.getResolutionKey(resolution)
      defaultValues[key] = 'false'
      formGroupData[key] = null
    }

    this.buildForm(formGroupData)

    this.configService.getCustomConfig()
      .subscribe(
        res => {
          this.customConfig = res

          this.oldCustomCSS = this.customConfig.instance.customizations.css
          this.oldCustomJavascript = this.customConfig.instance.customizations.javascript

          this.updateForm()
          // Force form validation
          this.forceCheck()
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  isTranscodingEnabled () {
    return this.form.value['transcodingEnabled'] === true
  }

  isSignupEnabled () {
    return this.form.value['signupEnabled'] === true
  }

  async formValidated () {
    const newCustomizationJavascript = this.form.value['customizationJavascript']
    const newCustomizationCSS = this.form.value['customizationCSS']

    const customizations = []
    if (newCustomizationJavascript && newCustomizationJavascript !== this.oldCustomJavascript) customizations.push('JavaScript')
    if (newCustomizationCSS && newCustomizationCSS !== this.oldCustomCSS) customizations.push('CSS')

    if (customizations.length !== 0) {
      const customizationsText = customizations.join('/')

      // FIXME: i18n service does not support string concatenation
      const message = this.i18n('You set custom {{customizationsText}}. ', { customizationsText }) +
        this.i18n('This could lead to security issues or bugs if you do not understand it. ') +
        this.i18n('Are you sure you want to update the configuration?')

      const label = this.i18n('Please type') + ` "I understand the ${customizationsText} I set" ` + this.i18n('to confirm.')
      const expectedInputValue = `I understand the ${customizationsText} I set`

      const confirmRes = await this.confirmService.confirmWithInput(message, label, expectedInputValue)
      if (confirmRes === false) return
    }

    const data: CustomConfig = {
      instance: {
        name: this.form.value['instanceName'],
        shortDescription: this.form.value['instanceShortDescription'],
        description: this.form.value['instanceDescription'],
        terms: this.form.value['instanceTerms'],
        defaultClientRoute: this.form.value['instanceDefaultClientRoute'],
        defaultNSFWPolicy: this.form.value['instanceDefaultNSFWPolicy'],
        customizations: {
          javascript: this.form.value['customizationJavascript'],
          css: this.form.value['customizationCSS']
        }
      },
      services: {
        twitter: {
          username: this.form.value['servicesTwitterUsername'],
          whitelisted: this.form.value['servicesTwitterWhitelisted']
        }
      },
      cache: {
        previews: {
          size: this.form.value['cachePreviewsSize']
        },
        captions: {
          size: this.form.value['cacheCaptionsSize']
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
      },
      import: {
        videos: {
          http: {
            enabled: this.form.value['importVideosHttpEnabled']
          },
          torrent: {
            enabled: this.form.value['importVideosTorrentEnabled']
          }
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

          this.notificationsService.success(this.i18n('Success'), this.i18n('Configuration updated.'))
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  private updateForm () {
    const data = {
      instanceName: this.customConfig.instance.name,
      instanceShortDescription: this.customConfig.instance.shortDescription,
      instanceDescription: this.customConfig.instance.description,
      instanceTerms: this.customConfig.instance.terms,
      instanceDefaultClientRoute: this.customConfig.instance.defaultClientRoute,
      instanceDefaultNSFWPolicy: this.customConfig.instance.defaultNSFWPolicy,
      servicesTwitterUsername: this.customConfig.services.twitter.username,
      servicesTwitterWhitelisted: this.customConfig.services.twitter.whitelisted,
      cachePreviewsSize: this.customConfig.cache.previews.size,
      cacheCaptionsSize: this.customConfig.cache.captions.size,
      signupEnabled: this.customConfig.signup.enabled,
      signupLimit: this.customConfig.signup.limit,
      adminEmail: this.customConfig.admin.email,
      userVideoQuota: this.customConfig.user.videoQuota,
      transcodingThreads: this.customConfig.transcoding.threads,
      transcodingEnabled: this.customConfig.transcoding.enabled,
      customizationJavascript: this.customConfig.instance.customizations.javascript,
      customizationCSS: this.customConfig.instance.customizations.css,
      importVideosHttpEnabled: this.customConfig.import.videos.http.enabled,
      importVideosTorrentEnabled: this.customConfig.import.videos.torrent.enabled
    }

    for (const resolution of this.resolutions) {
      const key = this.getResolutionKey(resolution)
      data[key] = this.customConfig.transcoding.resolutions[resolution]
    }

    this.form.patchValue(data)
  }

}
