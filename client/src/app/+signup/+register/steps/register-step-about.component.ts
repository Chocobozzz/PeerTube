import { Component, inject, input } from '@angular/core'
import { ServerService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { ServerStats } from '@peertube/peertube-models'
import { InstanceBannerComponent } from '../../../shared/shared-instance/instance-banner.component'
import { DaysDurationFormatterPipe } from '../../../shared/shared-main/date/days-duration-formatter.pipe'

@Component({
  selector: 'my-register-step-about',
  templateUrl: './register-step-about.component.html',
  styleUrls: [ './register-step-about.component.scss' ],
  imports: [ InstanceBannerComponent, DaysDurationFormatterPipe, AlertComponent ]
})
export class RegisterStepAboutComponent {
  private serverService = inject(ServerService)

  readonly requiresApproval = input<boolean>(undefined)
  readonly videoUploadDisabled = input<boolean>(undefined)
  readonly serverStats = input<ServerStats>(undefined)

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  get averageResponseTime () {
    return this.serverStats()?.averageRegistrationRequestResponseTimeMs
  }
}
