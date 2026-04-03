import { Component, ElementRef, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { OWNERSHIP_CHANGE_USERNAME_VALIDATOR } from '@app/shared/form-validators/video-ownership-change-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { UserAutoCompleteComponent } from '@app/shared/shared-forms/user-auto-complete.component'
import { ChangeOwnershipService } from '@app/shared/shared-main/video/change-ownership.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ChangeOwnership, ChangeOwnershipState } from '@peertube/peertube-models'
import { AutoCompleteModule } from 'primeng/autocomplete'
import { switchMap } from 'rxjs'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-video-change-ownership',
  templateUrl: './video-change-ownership.component.html',
  styleUrls: [ './video-change-ownership.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, AutoCompleteModule, UserAutoCompleteComponent ]
})
export class VideoChangeOwnershipComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private changeOwnershipService = inject(ChangeOwnershipService)
  private notifier = inject(Notifier)
  private modalService = inject(NgbModal)

  videoId = input.required<number>()
  requestSent = output<ChangeOwnership>()

  readonly modal = viewChild<ElementRef>('modal')

  error: string = null

  ngOnInit () {
    this.buildForm({
      username: OWNERSHIP_CHANGE_USERNAME_VALIDATOR
    })
  }

  show () {
    this.modalService
      .open(this.modal(), { centered: true })
      .result
      .then(() => this.changeOwnership())
      .catch(_ => _) // Called when closing (cancel) the modal without validating, do nothing
  }

  changeOwnership () {
    const username = this.form.value['username']

    this.changeOwnershipService
      .sendVideoChangeRequest(this.videoId(), username)
      .pipe(switchMap(() => this.changeOwnershipService.listFromVideo(this.videoId(), ChangeOwnershipState.PENDING)))
      .subscribe({
        next: ({ data }) => {
          this.requestSent.emit(data[0])
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
