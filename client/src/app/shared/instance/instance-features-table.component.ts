import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-instance-features-table',
  templateUrl: './instance-features-table.component.html',
  styleUrls: [ './instance-features-table.component.scss' ]
})
export class InstanceFeaturesTableComponent implements OnInit {
  features: { label: string, value?: boolean }[] = []
  quotaHelpIndication = ''

  constructor (
    private i18n: I18n,
    private serverService: ServerService
  ) {
  }

  get initialUserVideoQuota () {
    return this.serverService.getConfig().user.videoQuota
  }

  get dailyUserVideoQuota () {
    return Math.min(this.initialUserVideoQuota, this.serverService.getConfig().user.videoQuotaDaily)
  }

  ngOnInit () {
    this.serverService.configLoaded
        .subscribe(() => {
          this.buildFeatures()
          this.buildQuotaHelpIndication()
        })
  }

  buildNSFWLabel () {
    const policy = this.serverService.getConfig().instance.defaultNSFWPolicy

    if (policy === 'do_not_list') return this.i18n('Hidden')
    if (policy === 'blur') return this.i18n('Blurred with confirmation request')
    if (policy === 'display') return this.i18n('Displayed')
  }

  private buildFeatures () {
    const config = this.serverService.getConfig()

    this.features = [
      {
        label: this.i18n('User registration allowed'),
        value: config.signup.allowed
      },
      {
        label: this.i18n('Video uploads require manual validation by moderators'),
        value: config.autoBlacklist.videos.ofUsers.enabled
      },
      {
        label: this.i18n('Transcode your videos in multiple resolutions'),
        value: config.transcoding.enabledResolutions.length !== 0
      },
      {
        label: this.i18n('HTTP import (YouTube, Vimeo, direct URL...)'),
        value: config.import.videos.http.enabled
      },
      {
        label: this.i18n('Torrent import'),
        value: config.import.videos.torrent.enabled
      },
      {
        label: this.i18n('P2P enabled'),
        value: config.tracker.enabled
      }
    ]
  }

  private getApproximateTime (seconds: number) {
    const hours = Math.floor(seconds / 3600)
    let pluralSuffix = ''
    if (hours > 1) pluralSuffix = 's'
    if (hours > 0) return `~ ${hours} hour${pluralSuffix}`

    const minutes = Math.floor(seconds % 3600 / 60)

    return this.i18n('~ {{minutes}} {minutes, plural, =1 {minute} other {minutes}}', { minutes })
  }

  private buildQuotaHelpIndication () {
    if (this.initialUserVideoQuota === -1) return

    const initialUserVideoQuotaBit = this.initialUserVideoQuota * 8

    // 1080p: ~ 6Mbps
    // 720p: ~ 4Mbps
    // 360p: ~ 1.5Mbps
    const fullHdSeconds = initialUserVideoQuotaBit / (6 * 1000 * 1000)
    const hdSeconds = initialUserVideoQuotaBit / (4 * 1000 * 1000)
    const normalSeconds = initialUserVideoQuotaBit / (1.5 * 1000 * 1000)

    const lines = [
      this.i18n('{{seconds}} of full HD videos', { seconds: this.getApproximateTime(fullHdSeconds) }),
      this.i18n('{{seconds}} of HD videos', { seconds: this.getApproximateTime(hdSeconds) }),
      this.i18n('{{seconds}} of average quality videos', { seconds: this.getApproximateTime(normalSeconds) })
    ]

    this.quotaHelpIndication = lines.join('<br />')
  }
}
