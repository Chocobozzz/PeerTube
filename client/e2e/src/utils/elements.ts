function clickOnCheckbox (name: string) {
  return $(`my-peertube-checkbox[inputname=${name}] label`).click()
}

export {
  clickOnCheckbox
}
