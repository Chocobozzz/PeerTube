import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core'

@Directive({
  selector: '[myAutofocus]',
  standalone: true
})
export class AutofocusDirective implements AfterViewInit {
  private host = inject(ElementRef)

  ngAfterViewInit () {
    const el = this.host.nativeElement as HTMLElement

    el.focus({ preventScroll: true })
  }
}
