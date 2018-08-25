import { Component, ElementRef, ViewChild } from '@angular/core'
import { I18N_LOCALES } from '../../../../shared'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-language-chooser',
  templateUrl: './language-chooser.component.html',
  styleUrls: [ './language-chooser.component.scss' ]
})
export class LanguageChooserComponent {
  @ViewChild('modal') modal: ElementRef

  languages: { id: string, label: string }[] = []

  constructor (private modalService: NgbModal) {
    this.languages = Object.keys(I18N_LOCALES)
      .map(k => ({ id: k, label: I18N_LOCALES[k] }))
  }

  show () {
    this.modalService.open(this.modal)
  }

  buildLanguageLink (lang: { id: string }) {
    return window.location.origin + '/' + lang.id
  }

}
