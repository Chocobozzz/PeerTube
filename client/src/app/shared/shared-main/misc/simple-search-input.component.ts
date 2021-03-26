import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

@Component({
  selector: 'simple-search-input',
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

  private searchSubject = new Subject<string>()

  constructor (
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit () {
    this.searchSubject
        .pipe(
          debounceTime(400),
          distinctUntilChanged()
        )
        .subscribe(value => this.searchChanged.emit(value))

    this.searchSubject.next(this.value)

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

    this.searchChange()
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

  searchChange () {
    this.router.navigate([ './search' ], { relativeTo: this.route })

    this.searchSubject.next(this.value)
  }
}
