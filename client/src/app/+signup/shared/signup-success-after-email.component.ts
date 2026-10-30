import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ServerService } from '@app/core'
import { buildMobileAppLoginPath, buildMobileAppUrl, openMobileAppFallbackOnIOS } from '@app/helpers'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { SignupStepTitleComponent } from './signup-step-title.component'

@Component({
  selector: 'my-signup-success-after-email',
  templateUrl: './signup-success-after-email.component.html',
  styleUrls: [ './signup-success.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ SignupStepTitleComponent, AlertComponent, RouterLink ]
})
export class SignupSuccessAfterEmailComponent {
  private server = inject(ServerService)

  readonly requiresApproval = input<boolean>(undefined)

  readonly mobileAppUsername = input<string>()

  readonly mobileAppUrl = computed(() => {
    const username = this.mobileAppUsername()
    if (!username) return undefined

    return buildMobileAppUrl(this.server.getHTMLConfig().client.openInApp, buildMobileAppLoginPath({ afterSignup: true, username }))
  })

  onMobileAppClick () {
    openMobileAppFallbackOnIOS(this.server.getHTMLConfig().client.openInApp)
  }
}
