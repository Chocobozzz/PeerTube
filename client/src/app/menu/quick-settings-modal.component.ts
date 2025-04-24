import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, output, viewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, AuthStatus, LocalStorageService, PeerTubeRouterService, User, UserService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { UserInterfaceSettingsComponent } from '@app/shared/shared-user-settings/user-interface-settings.component'
import { UserVideoSettingsComponent } from '@app/shared/shared-user-settings/user-video-settings.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { ReplaySubject, Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'

@Component({
  selector: 'my-quick-settings',
  templateUrl: './quick-settings-modal.component.html',
  imports: [
    CommonModule,
    GlobalIconComponent,
    UserVideoSettingsComponent,
    UserInterfaceSettingsComponent,
    AlertComponent,
    ButtonComponent
  ]
})
export class QuickSettingsModalComponent implements OnInit, OnDestroy {
  private modalService = inject(NgbModal)
  private userService = inject(UserService)
  private authService = inject(AuthService)
  private localStorageService = inject(LocalStorageService)
  private route = inject(ActivatedRoute)
  private peertubeRouter = inject(PeerTubeRouterService)

  private static readonly QUERY_MODAL_NAME = 'quick-settings'

  readonly modal = viewChild<NgbModal>('modal')

  readonly openLanguageModal = output()

  user: User
  userInformationLoaded = new ReplaySubject<boolean>(1)

  private openedModal: NgbModalRef

  private routeSub: Subscription
  private loginSub: Subscription
  private localStorageSub: Subscription

  ngOnInit () {
    this.user = this.userService.getAnonymousUser()

    this.localStorageSub = this.localStorageService.watch()
      .subscribe({
        next: () => this.user = this.userService.getAnonymousUser()
      })

    this.userInformationLoaded.next(true)

    this.loginSub = this.authService.loginChangedSource
      .pipe(filter(status => status !== AuthStatus.LoggedIn))
      .subscribe({
        next: () => {
          this.user = this.userService.getAnonymousUser()
          this.userInformationLoaded.next(true)
        }
      })

    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['modal'] === QuickSettingsModalComponent.QUERY_MODAL_NAME) {
        this.openedModal = this.modalService.open(this.modal(), { centered: true })

        this.openedModal.hidden.subscribe(() => this.setModalQuery('remove'))
      }
    })
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
    if (this.loginSub) this.loginSub.unsubscribe()
    if (this.localStorageSub) this.localStorageSub.unsubscribe()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  show () {
    this.setModalQuery('add')
  }

  changeLanguage () {
    this.openedModal.close()
    this.openLanguageModal.emit()
  }

  private setModalQuery (type: 'add' | 'remove') {
    const modal = type === 'add'
      ? QuickSettingsModalComponent.QUERY_MODAL_NAME
      : null

    this.peertubeRouter.silentNavigate([], { modal }, this.route)
  }
}
