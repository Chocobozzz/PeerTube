import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { ItemSelectCheckboxValue } from './select-checkbox.component'
import { SelectCheckboxAllComponent } from './select-checkbox-all.component'

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
  ],
  standalone: true,
  imports: [ SelectCheckboxAllComponent, FormsModule ]
})
export class SelectLanguagesComponent implements ControlValueAccessor, OnInit {
  @Input() maxLanguages: number

  selectedLanguages: ItemSelectCheckboxValue[]
  availableLanguages: (SelectOptionsItem & { groupOrder: number })[] = []

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
          this.availableLanguages = [ {
            label: $localize`Unknown language`,
            id: '_unknown',
            group: this.allLanguagesGroup,
            groupOrder: 1
          } ]

          this.availableLanguages = this.availableLanguages
            .concat(languages.map(l => {
              if (l.id === 'zxx') return { label: l.label, id: l.id, group: $localize`Other`, groupOrder: 0 }
              return { label: l.label, id: l.id, group: this.allLanguagesGroup, groupOrder: 1 }
            }))

          this.availableLanguages.sort((a, b) => a.groupOrder - b.groupOrder)

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
