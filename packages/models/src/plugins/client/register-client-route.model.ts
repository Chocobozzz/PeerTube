export interface RegisterClientRouteOptions {
  route: string
  parentRoute?: string
  menuItem?: {
    label?: string
  }
  title?: string

  onMount (options: {
    rootEl: HTMLElement
  }): void
}
