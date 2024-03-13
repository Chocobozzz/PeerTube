import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EmbeddedViewRef,
  Injectable,
  Injector,
  OnChanges,
  SimpleChange,
  SimpleChanges,
  Type
} from '@angular/core'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { CustomMarkupComponent } from './peertube-custom-tags/shared'
import { firstValueFrom } from 'rxjs'

@Injectable()
export class DynamicElementService {

  constructor (
    private injector: Injector,
    private applicationRef: ApplicationRef
  ) { }

  createElement <T extends CustomMarkupComponent> (ofComponent: Type<T>) {
    const div = document.createElement('div')

    const component = createComponent(ofComponent, {
      environmentInjector: this.applicationRef.injector,
      elementInjector: this.injector,
      hostElement: div
    })

    const loadedPromise = component.instance.loaded
      ? firstValueFrom(component.instance.loaded)
      : undefined

    return { component, loadedPromise }
  }

  injectElement <T> (wrapper: HTMLElement, componentRef: ComponentRef<T>) {
    const hostView = componentRef.hostView as EmbeddedViewRef<any>

    this.applicationRef.attachView(hostView)
    wrapper.appendChild(hostView.rootNodes[0])
  }

  setModel <T> (componentRef: ComponentRef<T>, attributes: Partial<T>) {
    const changes: SimpleChanges = {}

    for (const key of objectKeysTyped(attributes)) {
      const previousValue = componentRef.instance[key]
      const newValue = attributes[key]

      componentRef.instance[key] = newValue
      changes[key as string] = new SimpleChange(previousValue, newValue, previousValue === undefined)
    }

    const component = componentRef.instance
    if (typeof (component as unknown as OnChanges).ngOnChanges === 'function') {
      (component as unknown as OnChanges).ngOnChanges(changes)
    }

    componentRef.changeDetectorRef.detectChanges()
  }
}
