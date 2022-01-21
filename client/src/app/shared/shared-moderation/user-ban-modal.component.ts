import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { User } from '@shared/models'
import { USER_BAN_REASON_VALIDATOR } from '../form-validators/user-validators'
import { UserAdminService } from '../shared-users'

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
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private userAdminService: UserAdminService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      reason: USER_BAN_REASON_VALIDATOR
    })
  }

  openModal (user: User | User[]) {
    this.usersToBan = user
    this.openedModal = this.modalService.open(this.modal, { centered: true })

    const isSingleUser = !(Array.isArray(this.usersToBan) && this.usersToBan.length > 1)
    this.modalMessage = isSingleUser ? $localize`Ban this user` : $localize`Ban these users`
  }

  hide () {
    this.usersToBan = undefined
    this.openedModal.close()
  }

  banUser () {
    const reason = this.form.value['reason'] || undefined

    this.userAdminService.banUsers(this.usersToBan, reason)
      .subscribe({
        next: () => {
          const message = Array.isArray(this.usersToBan)
            ? $localize`${this.usersToBan.length} users banned.`
            : $localize`User ${this.usersToBan.username} banned.`

          this.notifier.success(message)

          this.userBanned.emit(this.usersToBan)
          this.hide()
        },

        error: err => this.notifier.error(err.message)
      })
  }

}
