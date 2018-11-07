"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
function getConfig(url) {
    const path = '/api/v1/config';
    return __1.makeGetRequest({
        url,
        path,
        statusCodeExpected: 200
    });
}
exports.getConfig = getConfig;
function getAbout(url) {
    const path = '/api/v1/config/about';
    return __1.makeGetRequest({
        url,
        path,
        statusCodeExpected: 200
    });
}
exports.getAbout = getAbout;
function getCustomConfig(url, token, statusCodeExpected = 200) {
    const path = '/api/v1/config/custom';
    return __1.makeGetRequest({
        url,
        token,
        path,
        statusCodeExpected
    });
}
exports.getCustomConfig = getCustomConfig;
function updateCustomConfig(url, token, newCustomConfig, statusCodeExpected = 200) {
    const path = '/api/v1/config/custom';
    return __1.makePutBodyRequest({
        url,
        token,
        path,
        fields: newCustomConfig,
        statusCodeExpected
    });
}
exports.updateCustomConfig = updateCustomConfig;
function updateCustomSubConfig(url, token, newConfig) {
    const updateParams = {
        instance: {
            name: 'PeerTube updated',
            shortDescription: 'my short description',
            description: 'my super description',
            terms: 'my super terms',
            defaultClientRoute: '/videos/recently-added',
            defaultNSFWPolicy: 'blur',
            customizations: {
                javascript: 'alert("coucou")',
                css: 'body { background-color: red; }'
            }
        },
        services: {
            twitter: {
                username: '@MySuperUsername',
                whitelisted: true
            }
        },
        cache: {
            previews: {
                size: 2
            },
            captions: {
                size: 3
            }
        },
        signup: {
            enabled: false,
            limit: 5,
            requiresEmailVerification: false
        },
        admin: {
            email: 'superadmin1@example.com'
        },
        user: {
            videoQuota: 5242881,
            videoQuotaDaily: 318742
        },
        transcoding: {
            enabled: true,
            threads: 1,
            resolutions: {
                '240p': false,
                '360p': true,
                '480p': true,
                '720p': false,
                '1080p': false
            }
        },
        import: {
            videos: {
                http: {
                    enabled: false
                },
                torrent: {
                    enabled: false
                }
            }
        }
    };
    Object.assign(updateParams, newConfig);
    return updateCustomConfig(url, token, updateParams);
}
exports.updateCustomSubConfig = updateCustomSubConfig;
function deleteCustomConfig(url, token, statusCodeExpected = 200) {
    const path = '/api/v1/config/custom';
    return __1.makeDeleteRequest({
        url,
        token,
        path,
        statusCodeExpected
    });
}
exports.deleteCustomConfig = deleteCustomConfig;
