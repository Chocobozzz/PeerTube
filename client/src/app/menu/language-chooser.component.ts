import { Component, ElementRef, ViewChild } from '@angular/core'
import { I18N_LOCALES } from '../../../../shared'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { sortBy } from '@app/shared/misc/utils'

@Component({
  selector: 'my-language-chooser',
  templateUrl: './language-chooser.component.html',
  styleUrls: [ './language-chooser.component.scss' ]
})
export class LanguageChooserComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  languages: { id: string, label: string }[] = []

  constructor (private modalService: NgbModal) {
    const l = Object.keys(I18N_LOCALES)
                    .map(k => ({ id: k, label: I18N_LOCALES[k] }))

    this.languages = sortBy(l, 'label')
  }

  show () {
    this.modalService.open(this.modal, { centered: true })
  }

  buildLanguageLink (lang: { id: string }) {
    return window.location.origin + '/' + lang.id
  }

  getCurrentLanguage () {
    const english = 'English'
    const lang = window.location.pathname.split('/')[1]
    if (lang) return I18N_LOCALES[lang] || english
    return english
  }
}
