import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { AuthService, ServerService, User, UserService } from '@app/core'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig } from '@shared/models'

@Component({
  selector: 'my-account-setup-modal',
  templateUrl: './account-setup-modal.component.html',
  styleUrls: [ './account-setup-modal.component.scss' ]
})
export class AccountSetupModalComponent implements OnInit {
  @ViewChild('modal', { static: true }) modal: ElementRef

  user: User = null
  ref: NgbModalRef = null

  private serverConfig: HTMLServerConfig

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private modalService: NgbModal,
    private serverService: ServerService
  ) { }

  get userInformationLoaded () {
    return this.authService.userInformationLoaded
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  get isUserRoot () {
    return this.user.username === 'root'
  }

  get hasAccountAvatar () {
    return !!this.user.account.avatar
  }

  get hasAccountDescription () {
    return !!this.user.account.description
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.authService.userInformationLoaded
      .subscribe(
        () => {
          this.user = this.authService.getUser()

          if (this.isUserRoot) return
          if (this.hasAccountAvatar && this.hasAccountDescription) return
          if (this.userService.hasSignupInThisSession()) return

          this.show()
        }
      )
  }

  show () {
    if (this.ref) return

    this.ref = this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'md'
    })
  }
}
