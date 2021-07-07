import {
  ApplicationRef,
  ComponentFactoryResolver,
  ComponentRef,
  EmbeddedViewRef,
  Injectable,
  Injector,
  OnChanges,
  SimpleChange,
  SimpleChanges,
  Type
} from '@angular/core'

@Injectable()
export class DynamicElementService {

  constructor (
    private injector: Injector,
    private applicationRef: ApplicationRef,
    private componentFactoryResolver: ComponentFactoryResolver
  ) { }

  createElement <T> (ofComponent: Type<T>) {
    const div = document.createElement('div')

    const component = this.componentFactoryResolver.resolveComponentFactory(ofComponent)
      .create(this.injector, [], div)

    return component
  }

  injectElement <T> (wrapper: HTMLElement, componentRef: ComponentRef<T>) {
    const hostView = componentRef.hostView as EmbeddedViewRef<any>

    this.applicationRef.attachView(hostView)
    wrapper.appendChild(hostView.rootNodes[0])
  }

  setModel <T> (componentRef: ComponentRef<T>, attributes: Partial<T>) {
    const changes: SimpleChanges = {}

    for (const key of Object.keys(attributes)) {
      const previousValue = componentRef.instance[key]
      const newValue = attributes[key]

      componentRef.instance[key] = newValue
      changes[key] = new SimpleChange(previousValue, newValue, previousValue === undefined)
    }

    const component = componentRef.instance
    if (typeof (component as unknown as OnChanges).ngOnChanges === 'function') {
      (component as unknown as OnChanges).ngOnChanges(changes)
    }

    componentRef.changeDetectorRef.detectChanges()
  }
}
