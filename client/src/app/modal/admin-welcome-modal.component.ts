import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, User, UserService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-admin-welcome-modal',
  templateUrl: './admin-welcome-modal.component.html',
  styleUrls: [ './admin-welcome-modal.component.scss' ],
  imports: [ GlobalIconComponent ]
})
export class AdminWelcomeModalComponent implements OnInit {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Output() created = new EventEmitter<void>()

  private LS_KEYS = {
    NO_WELCOME_MODAL: 'no_welcome_modal'
  }

  constructor (
    private userService: UserService,
    private modalService: NgbModal,
    private notifier: Notifier
  ) { }

  ngOnInit () {
    this.created.emit()
  }

  shouldOpen (user: User) {
    if (this.modalService.hasOpenModals()) return false
    if (user.noWelcomeModal === true) return false
    if (peertubeLocalStorage.getItem(this.LS_KEYS.NO_WELCOME_MODAL) === 'true') return false

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
    peertubeLocalStorage.setItem(this.LS_KEYS.NO_WELCOME_MODAL, 'true')

    this.userService.updateMyProfile({ noWelcomeModal: true })
      .subscribe({
        next: () => logger.info('We will not open the welcome modal again.'),

        error: err => this.notifier.error(err.message)
      })
  }
}
