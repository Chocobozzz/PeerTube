import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { FormReactive, FormValidatorService, UserValidatorsService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User } from '@shared/models'

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

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private userService: UserService,
    private userValidatorsService: UserValidatorsService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      reason: this.userValidatorsService.USER_BAN_REASON
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

  async banUser () {
    const reason = this.form.value['reason'] || undefined

    this.userService.banUsers(this.usersToBan, reason)
      .subscribe(
        () => {
          const message = Array.isArray(this.usersToBan)
            ? this.i18n('{{num}} users banned.', { num: this.usersToBan.length })
            : this.i18n('User {{username}} banned.', { username: this.usersToBan.username })

          this.notifier.success(message)

          this.userBanned.emit(this.usersToBan)
          this.hide()
        },

          err => this.notifier.error(err.message)
      )
  }

}
