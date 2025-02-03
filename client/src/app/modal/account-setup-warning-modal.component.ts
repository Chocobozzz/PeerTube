import { CommonModule } from '@angular/common'
import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Notifier, ServerService, User, UserService } from '@app/core'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-account-setup-warning-modal',
  templateUrl: './account-setup-warning-modal.component.html',
  styleUrls: [ './account-setup-warning-modal.component.scss' ],
  imports: [ CommonModule, GlobalIconComponent, PeertubeCheckboxComponent, FormsModule, RouterLink ]
})
export class AccountSetupWarningModalComponent implements OnInit {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Output() created = new EventEmitter<void>()

  stopDisplayModal = false
  ref: NgbModalRef

  user: User

  private LS_KEYS = {
    NO_ACCOUNT_SETUP_WARNING_MODAL: 'no_account_setup_warning_modal'
  }

  ngOnInit (): void {
    this.created.emit()
  }

  constructor (
    private userService: UserService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private serverService: ServerService
  ) { }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  hasAccountAvatar (user: User) {
    return user.account.avatars.length !== 0
  }

  hasAccountDescription (user: User) {
    return !!user.account.description
  }

  shouldOpen (user: User) {
    if (this.modalService.hasOpenModals()) return false
    if (user.noAccountSetupWarningModal === true) return false
    if (peertubeLocalStorage.getItem(this.LS_KEYS.NO_ACCOUNT_SETUP_WARNING_MODAL) === 'true') return false

    if (this.hasAccountAvatar(user) && this.hasAccountDescription(user)) return false
    if (this.userService.hasSignupInThisSession()) return false

    return true
  }

  show (user: User) {
    this.user = user

    if (this.ref) return

    this.ref = this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'md'
    })

    this.ref.result.finally(() => {
      if (this.stopDisplayModal === true) this.doNotOpenAgain()
    })
  }

  private doNotOpenAgain () {
    peertubeLocalStorage.setItem(this.LS_KEYS.NO_ACCOUNT_SETUP_WARNING_MODAL, 'true')

    this.userService.updateMyProfile({ noAccountSetupWarningModal: true })
        .subscribe({
          next: () => logger.info('We will not open the account setup modal again.'),

          error: err => this.notifier.error(err.message)
        })
  }
}
