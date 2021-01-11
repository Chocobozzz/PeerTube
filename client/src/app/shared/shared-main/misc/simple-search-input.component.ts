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
  @ViewChild("searchVideos") input: ElementRef

  @Input() enter: string

  @Output() searchChanged = new EventEmitter<string>()

  search = ''
  shown: boolean

  private searchSubject= new Subject<string>()

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

    this.searchSubject.next(this.search)
  }

  showInput () {
    this.shown = true
    setTimeout(()=> {
      this.input.nativeElement.focus()
    })
  }

  focusLost () {
    if (this.search !== '') return
    this.shown = false
  }

  searchChange () {
    this.searchChanged.emit(this.search)
  }

  navigate () {
    this.router.navigate(['./search'], { relativeTo: this.route })
  }
}
