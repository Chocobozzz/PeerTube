import { CdkStepperModule } from '@angular/cdk/stepper'
import { Component, ElementRef, OnInit, inject, output, viewChild } from '@angular/core'
import { Notifier, User, UserService } from '@app/core'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { AdminConfigWizardStepperComponent } from './admin-config-wizard-stepper.component'
import { getNoWelcomeModalLocalStorageKey } from './shared/admin-config-wizard-modal-utils'
import { AdminConfigWizardDocumentationComponent } from './steps/admin-config-wizard-documentation.component'
import { AdminConfigWizardEditInfoComponent, FormEditInfo } from './steps/admin-config-wizard-edit-info.component'
import { AdminConfigWizardFormComponent } from './steps/admin-config-wizard-form.component'
import { AdminConfigWizardPreviewComponent } from './steps/admin-config-wizard-preview.component'
import { AdminConfigWizardWelcomeComponent } from './steps/admin-config-wizard-welcome.component'
import { UsageType } from './steps/usage-type/usage-type.model'

@Component({
  selector: 'my-admin-config-wizard-modal',
  templateUrl: './admin-config-wizard-modal.component.html',
  styleUrls: [ './admin-config-wizard-modal.component.scss' ],
  imports: [
    CdkStepperModule,
    AdminConfigWizardStepperComponent,
    AdminConfigWizardWelcomeComponent,
    AdminConfigWizardEditInfoComponent,
    AdminConfigWizardFormComponent,
    AdminConfigWizardPreviewComponent,
    AdminConfigWizardDocumentationComponent
  ]
})
export class AdminConfigWizardModalComponent implements OnInit {
  private modalService = inject(NgbModal)
  private userService = inject(UserService)
  private notifier = inject(Notifier)

  readonly modal = viewChild<ElementRef>('modal')
  readonly stepper = viewChild<AdminConfigWizardStepperComponent>('stepper')

  readonly created = output()

  usageType: UsageType
  instanceInfo: FormEditInfo

  showWelcome: boolean
  dryRun: boolean

  private modalRef: NgbModalRef

  ngOnInit () {
    this.created.emit()
  }

  shouldAutoOpen (user: User) {
    if (this.modalService.hasOpenModals()) return false
    if (this.getFragment() === '#admin-welcome-wizard') return true
    if (this.getFragment() === '#admin-welcome-wizard-test') return true
    if (user.noWelcomeModal === true) return false
    if (peertubeLocalStorage.getItem(getNoWelcomeModalLocalStorageKey()) === 'true') return false

    return true
  }

  show ({ showWelcome }: { showWelcome: boolean }) {
    this.showWelcome = showWelcome
    this.dryRun = this.getFragment() === '#admin-welcome-wizard-test'

    this.modalRef = this.modalService.open(this.modal(), {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    })
  }

  currentStep () {
    if (!this.stepper()) return 0

    const currentStep = this.stepper().selectedIndex

    // The welcome step is not counted in the total steps
    if (this.showWelcome) return currentStep

    return currentStep + 1
  }

  totalSteps () {
    if (!this.stepper()) return 0

    const totalSteps = this.stepper().steps.length

    // The welcome step is not counted in the total steps
    if (this.showWelcome) return totalSteps - 1

    return totalSteps
  }

  hide (options: { doNotOpenAgain?: boolean } = {}) {
    const { doNotOpenAgain = false } = options

    if (doNotOpenAgain) this.doNotOpenAgain()

    this.modalRef.close()
  }

  private doNotOpenAgain () {
    peertubeLocalStorage.setItem(getNoWelcomeModalLocalStorageKey(), 'true')

    this.userService.updateMyProfile({ noWelcomeModal: true })
      .subscribe({
        next: () => logger.info('We will not open the welcome modal again.'),

        error: err => this.notifier.error(err.message)
      })
  }

  private getFragment () {
    return window.location.hash
  }
}
