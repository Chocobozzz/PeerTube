import { CommonModule, DecimalPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { DaysDurationFormatterPipe } from '@app/shared/shared-main/date/days-duration-formatter.pipe'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { PluginSelectorDirective } from '@app/shared/shared-main/plugins/plugin-selector.directive'
import { ServerConfig, ServerStats } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { AuthService, ServerService } from '@app/core'
import { logger } from '@root-helpers/logger'

@Component({
  selector: 'my-instance-stat-rules',
  templateUrl: './instance-stat-rules.component.html',
  styleUrls: [ './instance-stat-rules.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
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
export class InstanceStatRulesComponent implements OnInit {
  private auth = inject(AuthService)
  private serverService = inject(ServerService)

  readonly config = input.required<ServerConfig>()
  readonly aboutHTML = input.required<AboutHTML>()

  // Stats can be slow to compute: load them in background and display placeholders in the meantime
  readonly stats = signal<ServerStats>(undefined)
  readonly statsError = signal(false)

  ngOnInit () {
    this.serverService.getServerStats()
      .subscribe({
        next: stats => this.stats.set(stats),

        error: err => {
          logger.error('Cannot load server stats', err)

          this.statsError.set(true)
        }
      })
  }

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
