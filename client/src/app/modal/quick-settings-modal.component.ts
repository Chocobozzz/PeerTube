import { ReplaySubject } from 'rxjs'
import { filter } from 'rxjs/operators'
import { Component, OnInit, ViewChild } from '@angular/core'
import { AuthService, AuthStatus, LocalStorageService, User, UserService } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'

@Component({
  selector: 'my-quick-settings',
  templateUrl: './quick-settings-modal.component.html',
  styleUrls: [ './quick-settings-modal.component.scss' ]
})
export class QuickSettingsModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  user: User
  userInformationLoaded = new ReplaySubject<boolean>(1)

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private userService: UserService,
    private authService: AuthService,
    private localStorageService: LocalStorageService
  ) {
    super()
  }

  ngOnInit () {
    this.user = this.userService.getAnonymousUser()
    this.localStorageService.watch()
      .subscribe(
        () => this.user = this.userService.getAnonymousUser()
      )

    this.userInformationLoaded.next(true)

    this.authService.loginChangedSource
      .pipe(filter(status => status !== AuthStatus.LoggedIn))
      .subscribe(
        () => {
          this.user = this.userService.getAnonymousUser()
          this.userInformationLoaded.next(true)
        }
      )
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { centered: true })
  }

  hide () {
    this.openedModal.close()
    this.form.reset()
  }
}
