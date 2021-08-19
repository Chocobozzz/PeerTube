import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { ItemSelectCheckboxValue } from './select-checkbox.component'

@Component({
  selector: 'my-select-languages',
  styleUrls: [ './select-shared.component.scss' ],
  templateUrl: './select-languages.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectLanguagesComponent),
      multi: true
    }
  ]
})
export class SelectLanguagesComponent implements ControlValueAccessor, OnInit {
  @Input() maxLanguages: number

  selectedLanguages: ItemSelectCheckboxValue[]
  availableLanguages: SelectOptionsItem[] = []

  allLanguagesGroup = $localize`All languages`

  // Fix a bug on ng-select when we update items after we selected items
  private toWrite: any
  private loaded = false

  constructor (
    private server: ServerService
  ) {

  }

  ngOnInit () {
    this.server.getVideoLanguages()
      .subscribe(
        languages => {
          this.availableLanguages = [ { label: $localize`Unknown language`, id: '_unknown', group: this.allLanguagesGroup } ]

          this.availableLanguages = this.availableLanguages
            .concat(languages.map(l => ({ label: l.label, id: l.id, group: this.allLanguagesGroup })))

          this.loaded = true
          this.writeValue(this.toWrite)
        }
      )
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (languages: ItemSelectCheckboxValue[]) {
    if (!this.loaded) {
      this.toWrite = languages
      return
    }

    this.selectedLanguages = languages
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedLanguages)
  }
}
