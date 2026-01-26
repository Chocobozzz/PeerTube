import { NgClass } from '@angular/common'
import { Component, ElementRef, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { WatchedWordsList } from '@peertube/peertube-models'
import { splitAndGetNotEmpty } from '@root-helpers/string'
import { UNIQUE_WATCHED_WORDS_VALIDATOR, WATCHED_WORDS_LIST_NAME_VALIDATOR } from '../form-validators/watched-words-list-validators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { WatchedWordsListService } from './watched-words-list.service'

@Component({
  selector: 'my-watched-words-list-save-modal',
  styleUrls: [ './watched-words-list-save-modal.component.scss' ],
  templateUrl: './watched-words-list-save-modal.component.html',
  imports: [ FormsModule, ReactiveFormsModule, GlobalIconComponent, NgClass ]
})
export class WatchedWordsListSaveModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private watchedWordsService = inject(WatchedWordsListService)

  readonly accountName = input.required<string>()

  readonly listAddedOrUpdated = output()

  readonly modal = viewChild<ElementRef>('modal')

  private openedModal: NgbModalRef
  private listToUpdate: WatchedWordsList

  ngOnInit () {
    this.buildForm({
      listName: WATCHED_WORDS_LIST_NAME_VALIDATOR,
      words: UNIQUE_WATCHED_WORDS_VALIDATOR
    })
  }

  show (list?: WatchedWordsList) {
    this.listToUpdate = list

    this.openedModal = this.modalService.open(this.modal(), { centered: true, keyboard: false })

    if (list) {
      this.form.patchValue({
        listName: list.listName,
        words: list.words.join('\n')
      })
    }
  }

  hide () {
    this.openedModal.close()
    this.form.reset()

    this.listToUpdate = undefined
  }

  addOrUpdate () {
    const commonParams = {
      accountName: this.accountName(),
      listName: this.form.value['listName'],
      words: splitAndGetNotEmpty(this.form.value['words'])
    }

    const obs = this.listToUpdate
      ? this.watchedWordsService.updateList({ ...commonParams, listId: this.listToUpdate.id })
      : this.watchedWordsService.addList(commonParams)

    obs.subscribe({
      next: () => {
        if (this.listToUpdate) {
          this.notifier.success($localize`${commonParams.listName} updated`)
        } else {
          this.notifier.success($localize`${commonParams.listName} created`)
        }

        this.listAddedOrUpdated.emit()
      },

      error: err => this.notifier.handleError(err)
    })

    this.hide()
  }
}
