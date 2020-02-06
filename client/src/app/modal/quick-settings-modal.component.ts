import { Component, ViewChild, OnInit } from '@angular/core'
import { AuthService, AuthStatus } from '@app/core'
import { FormReactive, FormValidatorService, UserService, User } from '@app/shared'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { ReplaySubject } from 'rxjs'
import { LocalStorageService } from '@app/shared/misc/storage.service'

@Component({
  selector: 'my-quick-settings',
  templateUrl: './quick-settings-modal.component.html',
  styleUrls: [ './quick-settings-modal.component.scss' ]
})
export class QuickSettingsModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  user: User
  userInformationLoaded = new ReplaySubject<boolean>(1)
  notify = true

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
    this.localStorageService.watch().subscribe(
      key => this.user = this.userService.getAnonymousUser()
    )
    this.userInformationLoaded.next(true)

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status !== AuthStatus.LoggedIn) {
          this.notify = false
          this.user = this.userService.getAnonymousUser()
          this.userInformationLoaded.next(true)
          this.notify = true
        }
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
