import { Component, OnInit } from '@angular/core'
import { ConfigService } from '@app/+admin/config/shared/config.service'
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

  resolutions: string[] = []
  transcodingThreadOptions: { label: string, value: number }[] = []

  private oldCustomJavascript: string
  private oldCustomCSS: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private customConfigValidatorsService: CustomConfigValidatorsService,
    private userValidatorsService: UserValidatorsService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()

    this.resolutions = [
      this.i18n('240p'),
      this.i18n('360p'),
      this.i18n('480p'),
      this.i18n('720p'),
      this.i18n('1080p')
    ]

    this.transcodingThreadOptions = [
      { value: 0, label: this.i18n('Auto (via ffmpeg)') },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' }
    ]
  }

  get videoQuotaOptions () {
    return this.configService.videoQuotaOptions
  }

  get videoQuotaDailyOptions () {
    return this.configService.videoQuotaDailyOptions
  }

  getResolutionKey (resolution: string) {
    return 'transcodingResolution' + resolution
  }

  ngOnInit () {
    const formGroupData: { [key: string]: any } = {
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
      signupRequiresEmailVerification: null,
      importVideosHttpEnabled: null,
      importVideosTorrentEnabled: null,
      adminEmail: this.customConfigValidatorsService.ADMIN_EMAIL,
      userVideoQuota: this.userValidatorsService.USER_VIDEO_QUOTA,
      userVideoQuotaDaily: this.userValidatorsService.USER_VIDEO_QUOTA_DAILY,
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
        limit: this.form.value['signupLimit'],
        requiresEmailVerification: this.form.value['signupRequiresEmailVerification']
      },
      admin: {
        email: this.form.value['adminEmail']
      },
      user: {
        videoQuota: this.form.value['userVideoQuota'],
        videoQuotaDaily: this.form.value['userVideoQuotaDaily']
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
    const data: { [key: string]: any } = {
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
      signupRequiresEmailVerification: this.customConfig.signup.requiresEmailVerification,
      adminEmail: this.customConfig.admin.email,
      userVideoQuota: this.customConfig.user.videoQuota,
      userVideoQuotaDaily: this.customConfig.user.videoQuotaDaily,
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
