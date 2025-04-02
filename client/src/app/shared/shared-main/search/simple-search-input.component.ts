import { Component, ElementRef, OnInit, input, output, viewChild } from '@angular/core'
import { NgIf } from '@angular/common'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'my-simple-search-input',
  templateUrl: './simple-search-input.component.html',
  styleUrls: [ './simple-search-input.component.scss' ],
  imports: [ FormsModule, GlobalIconComponent, NgIf ]
})
export class SimpleSearchInputComponent implements OnInit {
  readonly input = viewChild<ElementRef>('ref')

  readonly name = input('search')
  readonly placeholder = input($localize`Search`)
  readonly iconTitle = input($localize`Search`)
  readonly alwaysShow = input(true)

  readonly searchChanged = output<string>()
  readonly inputDisplayChanged = output<boolean>()

  value = ''
  lastSearch = ''
  inputShown: boolean

  ngOnInit () {
    if (this.isInputShown()) this.showInput(false)
  }

  isInputShown () {
    if (this.alwaysShow()) return true

    return this.inputShown
  }

  onIconClick () {
    if (!this.isInputShown()) {
      this.showInput()
      return
    }

    this.sendSearch()
  }

  showInput (focus = true) {
    this.inputShown = true
    this.inputDisplayChanged.emit(this.inputShown)

    if (focus) {
      setTimeout(() => this.input().nativeElement.focus())
    }
  }

  hideInput () {
    this.inputShown = false

    if (this.isInputShown() === false) {
      this.inputDisplayChanged.emit(this.inputShown)
    }
  }

  focusLost () {
    if (this.value) return

    this.hideInput()
  }

  sendSearch () {
    if (this.lastSearch === this.value) return

    this.lastSearch = this.value
    this.searchChanged.emit(this.value)
  }

  onResetFilter () {
    this.value = ''
    this.input().nativeElement.focus()

    this.sendSearch()
  }
}
