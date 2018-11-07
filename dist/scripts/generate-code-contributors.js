"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const requests_1 = require("../server/helpers/requests");
const fs_extra_1 = require("fs-extra");
run()
    .then(() => process.exit(0))
    .catch(err => {
    console.error(err);
    process.exit(-1);
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        {
            const contributors = yield fetchGithub('https://api.github.com/repos/chocobozzz/peertube/contributors');
            console.log('# Code\n');
            for (const contributor of contributors) {
                const contributorUrl = contributor.url.replace('api.github.com/users', 'github.com');
                console.log(` * [${contributor.login}](${contributorUrl})`);
            }
        }
        {
            const zanataConfig = fs_extra_1.readFileSync(require('os').homedir() + '/.config/zanata.ini').toString();
            const zanataUsername = zanataConfig.match('.username=([^\n]+)')[1];
            const zanataToken = zanataConfig.match('.key=([^\n]+)')[1];
            const translators = yield fetchZanata(zanataUsername, zanataToken);
            console.log('\n\n# Translations\n');
            for (const translator of translators) {
                console.log(` * [${translator.username}](https://trad.framasoft.org/zanata/profile/view/${translator.username})`);
            }
        }
        {
            console.log('\n\n# Design\n');
            console.log('By [Olivier Massain](https://twitter.com/omassain)\n');
            console.log('Icons from [Robbie Pearce](https://robbiepearce.com/softies/)');
        }
    });
}
function get(url, headers = {}) {
    return requests_1.doRequest({
        uri: url,
        json: true,
        headers: Object.assign(headers, {
            'User-Agent': 'PeerTube-App'
        })
    }).then(res => res.body);
}
function fetchGithub(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let next = url;
        let allResult = [];
        let i = 1;
        while (i < 20) {
            const result = yield get(next + '?page=' + i);
            if (result.length === 0)
                break;
            allResult = allResult.concat(result);
            i++;
        }
        return allResult;
    });
}
function fetchZanata(zanataUsername, zanataPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date().toISOString().split('T')[0];
        const url = `https://trad.framasoft.org/zanata/rest/project/peertube/version/develop/contributors/2018-01-01..${today}`;
        const headers = {
            'X-Auth-User': zanataUsername,
            'X-Auth-Token': zanataPassword
        };
        return get(url, headers);
    });
}
