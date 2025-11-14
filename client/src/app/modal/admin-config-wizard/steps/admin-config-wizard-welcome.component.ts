import { CdkStepperModule } from '@angular/cdk/stepper'

import { Component, inject, output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, UserService } from '@app/core'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { getNoWelcomeModalLocalStorageKey } from '../shared/admin-config-wizard-modal-utils'

@Component({
  selector: 'my-admin-config-wizard-welcome',
  templateUrl: './admin-config-wizard-welcome.component.html',
  styleUrls: [ '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, CdkStepperModule, ButtonComponent ]
})
export class AdminConfigWizardWelcomeComponent {
  private userService = inject(UserService)
  private notifier = inject(Notifier)

  readonly back = output()
  readonly next = output()
  readonly hide = output()

  doNotOpenAgain () {
    peertubeLocalStorage.setItem(getNoWelcomeModalLocalStorageKey(), 'true')

    this.userService.updateMyProfile({ noWelcomeModal: true })
      .subscribe({
        next: () => logger.info('We will not open the welcome modal again.'),

        error: err => this.notifier.error(err.message)
      })
  }
}
