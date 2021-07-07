#!/bin/bash

set -eu

declare -A languages
defaultLanguage="en-US"

# Supported languages
languages=(
    ["ar"]="ar"
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
    ["eo"]="eo"
    ["de"]="de-DE"
    ["it"]="it-IT"
    ["sq"]="sq"
    ["kab"]="kab"
)

cd client

rm -rf ./dist

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--source-map" ]; then
        additionalParams="--sourceMap=true"
    fi

    node --max_old_space_size=8192 node_modules/.bin/ng build --configuration production --output-path "dist/build" $additionalParams

    for key in "${!languages[@]}"; do
        lang=${languages[$key]}

        mv "dist/build/$key" "dist/$lang"

        if [ "$lang" != "en-US" ]; then
            # Do not duplicate assets
            rm -r "./dist/$lang/assets"
        fi
    done

    mv "./dist/$defaultLanguage/assets" "./dist"

    rmdir "dist/build"
else
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
        additionalParams="--namedChunks=true --outputHashing=none"
        export ANALYZE_BUNDLE=true
    fi

    node --max_old_space_size=8192 node_modules/.bin/ng build --localize=false --output-path "dist/$defaultLanguage/" \
                        --deploy-url "/client/$defaultLanguage/" --configuration production --stats-json $additionalParams
fi

cp "./dist/$defaultLanguage/manifest.webmanifest" "./dist/manifest.webmanifest"

cd ../ && npm run build:embed && cd client/

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
