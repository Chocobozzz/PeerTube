import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'

@Component({
  selector: 'my-simple-search-input',
  templateUrl: './simple-search-input.component.html',
  styleUrls: [ './simple-search-input.component.scss' ]
})
export class SimpleSearchInputComponent implements OnInit {
  @ViewChild('ref') input: ElementRef

  @Input() name = 'search'
  @Input() placeholder = $localize`Search`
  @Input() iconTitle = $localize`Search`
  @Input() alwaysShow = true

  @Output() searchChanged = new EventEmitter<string>()
  @Output() inputDisplayChanged = new EventEmitter<boolean>()

  value = ''
  inputShown: boolean

  private hasAlreadySentSearch = false

  ngOnInit () {
    if (this.isInputShown()) this.showInput(false)
  }

  isInputShown () {
    if (this.alwaysShow) return true

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
      setTimeout(() => this.input.nativeElement.focus())
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
    this.hasAlreadySentSearch = true
    this.searchChanged.emit(this.value)
  }

  onResetFilter () {
    this.value = ''

    if (this.hasAlreadySentSearch) this.sendSearch()
  }
}
