import { Component, Input } from '@angular/core'
import { ServerService } from '@app/core'
import { ServerStats } from '@peertube/peertube-models'
import { DaysDurationFormatterPipe } from '../../../shared/shared-main/angular/days-duration-formatter.pipe'
import { NgIf } from '@angular/common'
import { InstanceBannerComponent } from '../../../shared/shared-instance/instance-banner.component'

@Component({
  selector: 'my-register-step-about',
  templateUrl: './register-step-about.component.html',
  styleUrls: [ './register-step-about.component.scss' ],
  standalone: true,
  imports: [ InstanceBannerComponent, NgIf, DaysDurationFormatterPipe ]
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
