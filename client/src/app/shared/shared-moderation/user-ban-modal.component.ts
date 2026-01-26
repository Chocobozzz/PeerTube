import { NgClass } from '@angular/common'
import { Component, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { User } from '@peertube/peertube-models'
import { forkJoin } from 'rxjs'
import { USER_BAN_REASON_VALIDATOR } from '../form-validators/user-validators'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { Account } from '../shared-main/account/account.model'
import { UserAdminService } from '../shared-users/user-admin.service'
import { BlocklistService } from './blocklist.service'

@Component({
  selector: 'my-user-ban-modal',
  templateUrl: './user-ban-modal.component.html',
  styleUrls: [ './user-ban-modal.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, PeertubeCheckboxComponent ]
})
export class UserBanModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private userAdminService = inject(UserAdminService)
  private blocklistService = inject(BlocklistService)

  readonly modal = viewChild<NgbModal>('modal')
  readonly userBanned = output<User | User[]>()

  private usersToBan: User | User[]
  private openedModal: NgbModalRef
  modalMessage = ''

  ngOnInit () {
    this.buildForm({
      reason: USER_BAN_REASON_VALIDATOR,
      mute: null
    })
  }

  openModal (user: User | User[]) {
    this.usersToBan = user
    this.openedModal = this.modalService.open(this.modal(), { centered: true })
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

        error: err => this.notifier.handleError(err)
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
