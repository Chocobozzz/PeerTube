#!/bin/sh

set -eu

git fetch weblate && git merge weblate/develop

cd client
npm run ng -- extract-i18n --out-file src/locale/angular.xlf

# Merge new translations in other language files
node ./node_modules/.bin/xliffmerge -p ./.xliffmerge.json "ar" "is" "hr" "ca-ES" "gl-ES" "cs-CZ" "da-DK" "de-DE" "el-GR" "en-GB" "en-US" "eo" "es-ES" "eu-ES" "fa-IR" "fi-FI" "fr-FR" "gd" "gl-ES" "hu-HU" "it-IT" "ja-JP" "jbo" "kab" "ko-KR" "lt-LT" "nb-NO" "nl-NL" "oc" "pl-PL" "pt-BR" "pt-PT" "ru-RU" "sk-SK" "sl-SI" "sv-SE" "ta" "th-TH" "tr-TR" "uk-UA" "vi-VN" "zh-Hans-CN" "zh-Hant-TW" "nn" "nb-NO" "tok" "sk-SK"

# Add our strings too
cd ../
npm run i18n:create-custom-files
