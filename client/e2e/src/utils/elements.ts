async function getCheckbox (name: string) {
  const input = $(`my-peertube-checkbox input[id=${name}]`)
  await input.waitForExist()

  return input.parentElement()
}

function isCheckboxSelected (name: string) {
  return $(`input[id=${name}]`).isSelected()
}

async function selectCustomSelect (id: string, valueLabel: string) {
  const wrapper = $(`[formcontrolname=${id}] span[role=combobox]`)

  await wrapper.waitForClickable()
  await wrapper.click()

  const option = await $$(`[formcontrolname=${id}] li[role=option]`).filter(async o => {
    const text = await o.getText()

    return text.trimStart().startsWith(valueLabel)
  }).then(options => options[0])

  await option.waitForDisplayed()

  return option.click()
}

async function findParentElement (
  el: WebdriverIO.Element,
  finder: (el: WebdriverIO.Element) => Promise<boolean>
) {
  if (await finder(el) === true) return el

  return findParentElement(await el.parentElement(), finder)
}

export {
  getCheckbox,
  isCheckboxSelected,
  selectCustomSelect,
  findParentElement
}
