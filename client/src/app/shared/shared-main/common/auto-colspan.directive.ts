import { AfterViewInit, Directive, ElementRef, Renderer2, inject } from '@angular/core'

@Directive({
  selector: '[myAutoColspan]',
  standalone: true
})
export class AutoColspanDirective implements AfterViewInit {
  private host = inject(ElementRef)
  private renderer = inject(Renderer2)

  ngAfterViewInit () {
    const el = this.host.nativeElement as HTMLElement
    const table = el.closest('table')
    if (!table) throw new Error('table element not found')

    const th = table.querySelectorAll('th')

    this.renderer.setAttribute(el, 'colspan', th.length + '')
  }
}
