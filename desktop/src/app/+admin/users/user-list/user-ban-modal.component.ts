import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, UserValidatorsService } from '../../../shared'
import { UserService } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { User } from '../../../../../../shared'

@Component({
  selector: 'my-user-ban-modal',
  templateUrl: './user-ban-modal.component.html',
  styleUrls: [ './user-ban-modal.component.scss' ]
})
export class UserBanModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal') modal: NgbModal
  @Output() userBanned = new EventEmitter<User>()

  private userToBan: User
  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private notificationsService: NotificationsService,
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

  openModal (user: User) {
    this.userToBan = user
    this.openedModal = this.modalService.open(this.modal)
  }

  hideBanUserModal () {
    this.userToBan = undefined
    this.openedModal.close()
  }

  async banUser () {
    const reason = this.form.value['reason'] || undefined

    this.userService.banUser(this.userToBan, reason)
      .subscribe(
        () => {
          this.notificationsService.success(
            this.i18n('Success'),
            this.i18n('User {{username}} banned.', { username: this.userToBan.username })
          )

          this.userBanned.emit(this.userToBan)
          this.hideBanUserModal()
        },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

}
