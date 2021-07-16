export interface ConstantManager <K extends string | number> {
  addConstant: (key: K, label: string) => boolean
  deleteConstant: (key: K) => boolean
  getConstantValue: (key: K) => string
  getConstants: () => Record<K, string>
  resetConstants: () => void
}
