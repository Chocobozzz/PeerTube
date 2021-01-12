import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'

@Component({
  selector: 'simple-search-input',
  templateUrl: './simple-search-input.component.html',
  styleUrls: [ './simple-search-input.component.scss' ]
})
export class SimpleSearchInputComponent implements OnInit {
  @ViewChild('ref') input: ElementRef

  @Input() name = 'search'
  @Input() placeholder = $localize`Search`

  @Output() searchChanged = new EventEmitter<string>()

  value = ''
  shown: boolean

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
  }

  showInput () {
    this.shown = true
    setTimeout(() => this.input.nativeElement.focus())
  }

  focusLost () {
    if (this.value !== '') return
    this.shown = false
  }

  searchChange () {
    this.router.navigate(['./search'], { relativeTo: this.route })
    this.searchSubject.next(this.value)
  }
}
