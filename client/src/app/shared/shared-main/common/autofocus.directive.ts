import { AfterViewInit, Directive, ElementRef } from '@angular/core'

@Directive({
  selector: '[myAutofocus]',
  standalone: true
})
export class AutofocusDirective implements AfterViewInit {
  constructor (private host: ElementRef) { }

  ngAfterViewInit () {
    const el = this.host.nativeElement as HTMLElement

    el.focus({ preventScroll: true })
  }
}
