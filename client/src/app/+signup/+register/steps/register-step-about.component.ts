import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'
import { ServerService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { ServerStats } from '@peertube/peertube-models'
import { InstanceBannerComponent } from '../../../shared/shared-instance/instance-banner.component'
import { DaysDurationFormatterPipe } from '../../../shared/shared-main/date/days-duration-formatter.pipe'

@Component({
  selector: 'my-register-step-about',
  templateUrl: './register-step-about.component.html',
  styleUrls: [ './register-step-about.component.scss' ],
  imports: [ InstanceBannerComponent, NgIf, DaysDurationFormatterPipe, AlertComponent ]
})
export class RegisterStepAboutComponent {
  @Input() requiresApproval: boolean
  @Input() videoUploadDisabled: boolean
  @Input() serverStats: ServerStats

  constructor (private serverService: ServerService) {

  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  get averageResponseTime () {
    return this.serverStats?.averageRegistrationRequestResponseTimeMs
  }
}
