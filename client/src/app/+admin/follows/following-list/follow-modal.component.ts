import { NgClass, NgIf } from '@angular/common'
import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { UNIQUE_HOSTS_OR_HANDLE_VALIDATOR } from '@app/shared/form-validators/host-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { splitAndGetNotEmpty } from '@root-helpers/string'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-follow-modal',
  templateUrl: './follow-modal.component.html',
  styleUrls: [ './follow-modal.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, NgIf ]
})
export class FollowModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  @Output() newFollow = new EventEmitter<void>()

  placeholder = 'example.com\nchocobozzz@example.com\nchocobozzz_channel@example.com'

  private openedModal: NgbModalRef

  constructor (
    protected formReactiveService: FormReactiveService,
    private modalService: NgbModal,
    private followService: InstanceFollowService,
    private notifier: Notifier
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      hostsOrHandles: UNIQUE_HOSTS_OR_HANDLE_VALIDATOR
    })
  }

  openModal () {
    this.openedModal = this.modalService.open(this.modal, { centered: true })
  }

  hide () {
    this.openedModal.close()
  }

  submit () {
    this.addFollowing()

    this.form.reset()
    this.hide()
  }

  httpEnabled () {
    return window.location.protocol === 'https:'
  }

  private addFollowing () {
    const hostsOrHandles = splitAndGetNotEmpty(this.form.value['hostsOrHandles'])

    this.followService.follow(hostsOrHandles)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Follow request sent!} other {Follow requests sent!}}`,
              { count: hostsOrHandles.length }
            )
          )

          this.newFollow.emit()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
