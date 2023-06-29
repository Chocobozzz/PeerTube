import { forkJoin } from 'rxjs'
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { User } from '@shared/models'
import { USER_BAN_REASON_VALIDATOR } from '../form-validators/user-validators'
import { Account } from '../shared-main'
import { UserAdminService } from '../shared-users'
import { BlocklistService } from './blocklist.service'

@Component({
  selector: 'my-user-ban-modal',
  templateUrl: './user-ban-modal.component.html',
  styleUrls: [ './user-ban-modal.component.scss' ]
})
export class UserBanModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal
  @Output() userBanned = new EventEmitter<User | User[]>()

  private usersToBan: User | User[]
  private openedModal: NgbModalRef
  modalMessage = ''

  constructor (
    protected formReactiveService: FormReactiveService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private userAdminService: UserAdminService,
    private blocklistService: BlocklistService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      reason: USER_BAN_REASON_VALIDATOR,
      mute: null
    })
  }

  openModal (user: User | User[]) {
    this.usersToBan = user
    this.openedModal = this.modalService.open(this.modal, { centered: true })
  }

  hide () {
    this.usersToBan = undefined
    this.openedModal.close()
  }

  banUser () {
    const reason = this.form.value['reason'] || undefined
    const mute = this.form.value['mute']

    const observables = [
      this.userAdminService.banUsers(this.usersToBan, reason)
    ]

    if (mute) observables.push(this.muteAccounts())

    forkJoin(observables)
      .subscribe({
        next: () => {
          let message: string

          if (Array.isArray(this.usersToBan)) {
            message = formatICU(
              $localize`{count, plural, =1 {1 user banned.} other {{count} users banned.}}`,
              { count: this.usersToBan.length }
            )
          } else {
            message = $localize`User ${this.usersToBan.username} banned.`
          }

          this.notifier.success(message)

          this.userBanned.emit(this.usersToBan)

          this.hide()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  getModalTitle () {
    if (Array.isArray(this.usersToBan)) {
      return formatICU(
        $localize`Ban {count, plural, =1 {1 user} other {{count} users}}`,
        { count: this.usersToBan.length }
      )
    }

    return $localize`Ban "${this.usersToBan.username}"`
  }

  private muteAccounts () {
    const accounts = Array.isArray(this.usersToBan)
      ? this.usersToBan.map(u => new Account(u.account))
      : new Account(this.usersToBan.account)

    return this.blocklistService.blockAccountByInstance(accounts)
  }
}
