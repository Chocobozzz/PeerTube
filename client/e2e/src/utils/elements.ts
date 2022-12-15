async function getCheckbox (name: string) {
  const input = $(`my-peertube-checkbox input[id=${name}]`)
  await input.waitForExist()

  return input.parentElement()
}

async function selectCustomSelect (id: string, valueLabel: string) {
  const wrapper = $(`[formcontrolname=${id}] .ng-arrow-wrapper`)

  await wrapper.waitForClickable()
  await wrapper.click()

  const option = await $$(`[formcontrolname=${id}] .ng-option`).filter(async o => {
    const text = await o.getText()

    return text.trimStart().startsWith(valueLabel)
  }).then(options => options[0])

  await option.waitForDisplayed()

  return option.click()
}

export {
  getCheckbox,
  selectCustomSelect
}
