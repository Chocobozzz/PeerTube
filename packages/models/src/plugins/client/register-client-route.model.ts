export interface RegisterClientRouteOptions {
  route: string
  parentRoute?: string
  menuItem?: {
    label?: string
  }

  onMount (options: {
    rootEl: HTMLElement
  }): void
}
