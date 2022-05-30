import { AfterViewInit, Directive, ElementRef } from '@angular/core'

@Directive({
  selector: '[autofocus]'
})
export class AutofocusDirective implements AfterViewInit {
  constructor (private host: ElementRef) { }

  ngAfterViewInit () {
    this.host.nativeElement.focus()
  }
}
