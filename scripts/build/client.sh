#!/bin/bash

set -eu

declare -A languages
defaultLanguage="en-US"

# Supported languages
languages=(
    ["ar"]="ar"
    ["sk"]="sk-SK"
    ["is"]="is"
    ["tr"]="tr-TR"
    ["fa"]="fa-IR"
    ["en"]="en-US"
    ["vi"]="vi-VN"
    ["hu"]="hu-HU"
    ["th"]="th-TH"
    ["fi"]="fi-FI"
    ["nl"]="nl-NL"
    ["gd"]="gd"
    ["el"]="el-GR"
    ["es"]="es-ES"
    ["oc"]="oc"
    ["pt"]="pt-BR"
    ["pt-PT"]="pt-PT"
    ["sv"]="sv-SE"
    ["pl"]="pl-PL"
    ["ru"]="ru-RU"
    ["zh-Hans"]="zh-Hans-CN"
    ["zh-Hant"]="zh-Hant-TW"
    ["fr"]="fr-FR"
    ["ja"]="ja-JP"
    ["eu"]="eu-ES"
    ["ca"]="ca-ES"
    ["gl"]="gl-ES"
    ["cs"]="cs-CZ"
    ["hr"]="hr"
    ["eo"]="eo"
    ["de"]="de-DE"
    ["it"]="it-IT"
    ["uk"]="uk-UA"
    ["sq"]="sq"
    ["tok"]="tok"
    ["nn"]="nn"
    ["nb"]="nb-NO"
    ["kab"]="kab"
)


rm -rf ./client/dist

npm run build:embed

cd client

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--source-map" ]; then
        additionalParams="--source-map=true"
    fi

    node --max_old_space_size=8192 node_modules/.bin/ng build --configuration production --output-path "dist/build" $additionalParams

    for key in "${!languages[@]}"; do
        lang=${languages[$key]}

        mv "dist/build/browser/$key" "dist/$lang"

        if [ "$lang" != "en-US" ]; then
            # Do not duplicate assets
            rm -r "./dist/$lang/assets"
        fi
    done

    mv "./dist/$defaultLanguage/assets" "./dist"

    rm -r "dist/build"
    cp "./dist/$defaultLanguage/manifest.webmanifest" "./dist/manifest.webmanifest"
else
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
        additionalParams="--named-chunks=true --output-hashing=none"

        # For Vite
        export ANALYZE_BUNDLE=true
    fi

    node --max_old_space_size=8192 node_modules/.bin/ng build --localize=false --output-path "dist/$defaultLanguage/" \
                                                              --configuration production --stats-json $additionalParams
fi

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
