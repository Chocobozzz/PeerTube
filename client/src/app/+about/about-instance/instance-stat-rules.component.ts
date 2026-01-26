import { CommonModule, DecimalPipe } from '@angular/common'
import { Component, inject, input } from '@angular/core'
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
    GlobalIconComponent,
    DecimalPipe,
    DaysDurationFormatterPipe,
    BytesPipe,
    PluginSelectorDirective,
    RouterLink
  ]
})
export class InstanceStatRulesComponent {
  private auth = inject(AuthService)

  readonly stats = input.required<ServerStats>()
  readonly config = input.required<ServerConfig>()
  readonly aboutHTML = input.required<AboutHTML>()

  canUpload () {
    const user = this.auth.getUser()

    if (user) {
      if (user.videoQuota === 0 || user.videoQuotaDaily === 0) return false

      return true
    }

    const config = this.config()
    return config.user.videoQuota !== 0 && config.user.videoQuotaDaily !== 0
  }

  canPublishLive () {
    return this.config().live.enabled
  }

  isContactFormEnabled () {
    const config = this.config()
    return config.email.enabled && config.contactForm.enabled
  }
}
