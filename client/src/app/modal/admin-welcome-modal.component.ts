import { Component, ElementRef, ViewChild } from '@angular/core'
import { Notifier, User, UserService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-admin-welcome-modal',
  templateUrl: './admin-welcome-modal.component.html',
  styleUrls: [ './admin-welcome-modal.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent ]
})
export class AdminWelcomeModalComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  private LOCAL_STORAGE_KEYS = {
    NO_WELCOME_MODAL: 'no_welcome_modal'
  }

  constructor (
    private userService: UserService,
    private modalService: NgbModal,
    private notifier: Notifier
  ) { }

  shouldOpen (user: User) {
    if (user.noWelcomeModal === true) return false
    if (peertubeLocalStorage.getItem(this.LOCAL_STORAGE_KEYS.NO_WELCOME_MODAL) === 'true') return false

    return true
  }

  show () {
    this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    })
  }

  doNotOpenAgain () {
    peertubeLocalStorage.setItem(this.LOCAL_STORAGE_KEYS.NO_WELCOME_MODAL, 'true')

    this.userService.updateMyProfile({ noWelcomeModal: true })
      .subscribe({
        next: () => logger.info('We will not open the welcome modal again.'),

        error: err => this.notifier.error(err.message)
      })
  }
}
