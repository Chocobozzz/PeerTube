import { CommonModule, DecimalPipe, NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { DaysDurationFormatterPipe } from '@app/shared/shared-main/date/days-duration-formatter.pipe'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { PluginSelectorDirective } from '@app/shared/shared-main/plugins/plugin-selector.directive'
import { ServerConfig, ServerStats } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { AuthService } from '@app/core'

@Component({
  selector: 'my-instance-stat-rules',
  templateUrl: './instance-stat-rules.component.html',
  styleUrls: [ './instance-stat-rules.component.scss' ],
  imports: [
    CommonModule,
    NgIf,
    GlobalIconComponent,
    DecimalPipe,
    DaysDurationFormatterPipe,
    BytesPipe,
    PluginSelectorDirective,
    RouterLink
  ]
})
export class InstanceStatRulesComponent {
  @Input({ required: true }) stats: ServerStats
  @Input({ required: true }) config: ServerConfig
  @Input({ required: true }) aboutHTML: AboutHTML

  constructor (private auth: AuthService) {

  }

  canUpload () {
    const user = this.auth.getUser()

    if (user) {
      if (user.videoQuota === 0 || user.videoQuotaDaily === 0) return false

      return true
    }

    return this.config.user.videoQuota !== 0 && this.config.user.videoQuotaDaily !== 0
  }

  canPublishLive () {
    return this.config.live.enabled
  }

  isContactFormEnabled () {
    return this.config.email.enabled && this.config.contactForm.enabled
  }
}
