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
const program = require("commander");
const prompt = require("prompt");
const Table = require('cli-table');
const cli_1 = require("./cli");
const servers_1 = require("../helpers/custom-validators/servers");
const users_1 = require("../helpers/custom-validators/users");
function delInstance(url) {
    return new Promise((res, rej) => {
        cli_1.getSettings()
            .then((settings) => __awaiter(this, void 0, void 0, function* () {
            settings.remotes.splice(settings.remotes.indexOf(url));
            yield cli_1.writeSettings(settings);
            delete cli_1.netrc.machines[url];
            cli_1.netrc.save();
            res();
        }))
            .catch(err => rej(err));
    });
}
function setInstance(url, username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res, rej) => {
            cli_1.getSettings()
                .then((settings) => __awaiter(this, void 0, void 0, function* () {
                if (settings.remotes.indexOf(url) === -1) {
                    settings.remotes.push(url);
                }
                yield cli_1.writeSettings(settings);
                cli_1.netrc.machines[url] = { login: username, password };
                cli_1.netrc.save();
                res();
            }))
                .catch(err => rej(err));
        });
    });
}
function isURLaPeerTubeInstance(url) {
    return servers_1.isHostValid(url) || (url.includes('localhost'));
}
program
    .name('auth')
    .usage('[command] [options]');
program
    .command('add')
    .description('remember your accounts on remote instances for easier use')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('--default', 'add the entry as the new default')
    .action(options => {
    prompt.override = options;
    prompt.start();
    prompt.get({
        properties: {
            url: {
                description: 'instance url',
                conform: (value) => isURLaPeerTubeInstance(value),
                required: true
            },
            username: {
                conform: (value) => users_1.isUserUsernameValid(value),
                message: 'Name must be only letters, spaces, or dashes',
                required: true
            },
            password: {
                hidden: true,
                replace: '*',
                required: true
            }
        }
    }, (_, result) => {
        setInstance(result.url, result.username, result.password);
    });
});
program
    .command('del <url>')
    .description('unregisters a remote instance')
    .action((url) => {
    delInstance(url);
});
program
    .command('list')
    .description('lists registered remote instances')
    .action(() => {
    cli_1.getSettings()
        .then(settings => {
        const table = new Table({
            head: ['instance', 'login'],
            colWidths: [30, 30]
        });
        cli_1.netrc.loadSync();
        settings.remotes.forEach(element => {
            table.push([
                element,
                cli_1.netrc.machines[element].login
            ]);
        });
        console.log(table.toString());
    });
});
program
    .command('set-default <url>')
    .description('set an existing entry as default')
    .action((url) => {
    cli_1.getSettings()
        .then(settings => {
        const instanceExists = settings.remotes.indexOf(url) !== -1;
        if (instanceExists) {
            settings.default = settings.remotes.indexOf(url);
            cli_1.writeSettings(settings);
        }
        else {
            console.log('<url> is not a registered instance.');
            process.exit(-1);
        }
    });
});
program.on('--help', function () {
    console.log('  Examples:');
    console.log();
    console.log('    $ peertube add -u peertube.cpy.re -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"');
    console.log('    $ peertube add -u peertube.cpy.re -U root');
    console.log('    $ peertube list');
    console.log('    $ peertube del peertube.cpy.re');
    console.log();
});
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
program.parse(process.argv);
//# sourceMappingURL=peertube-auth.js.map