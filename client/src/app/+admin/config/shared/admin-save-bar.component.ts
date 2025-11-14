import { Component, inject, input, OnDestroy, OnInit, output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { ScreenService, ServerService } from '@app/core'
import { HeaderService } from '@app/header/header.service'
import { FormReactiveErrors, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'

@Component({
  selector: 'my-admin-save-bar',
  styleUrls: [ './admin-save-bar.component.scss' ],
  templateUrl: './admin-save-bar.component.html',
  imports: [
    RouterModule,
    ButtonComponent,
    AlertComponent
  ]
})
export class AdminSaveBarComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private server = inject(ServerService)
  private headerService = inject(HeaderService)
  private screenService = inject(ScreenService)
  private peertubeModal = inject(PeertubeModalService)

  readonly title = input.required<string>()
  readonly form = input.required<FormGroup>()
  readonly formErrors = input.required<FormReactiveErrors>()
  readonly inconsistentOptions = input<string>()

  readonly save = output()

  displayFormErrors = false

  ngOnInit () {
    if (this.screenService.isInMobileView()) {
      this.headerService.setSearchHidden(true)
    }
  }

  ngOnDestroy () {
    this.headerService.setSearchHidden(false)
  }

  isUpdateAllowed () {
    return this.server.getHTMLConfig().webadmin.configuration.edition.allowed === true
  }

  canUpdate () {
    if (!this.isUpdateAllowed()) return false
    if (this.inconsistentOptions()) return false

    return this.form().dirty
  }

  grabAllErrors () {
    return this.formReactiveService.grabAllErrors(this.formErrors())
  }

  openConfigWizard () {
    this.peertubeModal.openAdminConfigWizardSubject.next({ showWelcome: false })
  }

  onSave (event: Event) {
    this.displayFormErrors = false

    if (this.form().valid) {
      this.save.emit()
      return
    }

    event.preventDefault()

    this.displayFormErrors = true
  }
}
