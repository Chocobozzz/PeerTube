import { Component, ViewChild } from '@angular/core'
import { ModalDirective } from 'ngx-bootstrap/modal'
import { I18N_LOCALES } from '../../../../shared'

@Component({
  selector: 'my-language-chooser',
  templateUrl: './language-chooser.component.html',
  styleUrls: [ './language-chooser.component.scss' ]
})
export class LanguageChooserComponent {
  @ViewChild('modal') modal: ModalDirective

  languages: { [ id: string ]: string }[] = []

  constructor () {
    this.languages = Object.keys(I18N_LOCALES)
      .map(k => ({ id: k, label: I18N_LOCALES[k] }))
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
  }

  buildLanguageLink (lang: { id: string }) {
    return window.location.origin + '/' + lang.id
  }

}
