"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const initializers_1 = require("../server/initializers");
const user_1 = require("../server/models/account/user");
program
    .option('-u, --user [user]', 'User')
    .parse(process.argv);
if (program['user'] === undefined) {
    console.error('All parameters are mandatory.');
    process.exit(-1);
}
initializers_1.initDatabaseModels(true)
    .then(() => {
    return user_1.UserModel.loadByUsername(program['user']);
})
    .then(user => {
    if (!user) {
        console.error('User unknown.');
        process.exit(-1);
    }
    const readline = require('readline');
    const Writable = require('stream').Writable;
    const mutableStdout = new Writable({
        write: function (chunk, encoding, callback) {
            callback();
        }
    });
    const rl = readline.createInterface({
        input: process.stdin,
        output: mutableStdout,
        terminal: true
    });
    console.log('New password?');
    rl.on('line', function (password) {
        user.password = password;
        user.save()
            .then(() => console.log('User password updated.'))
            .catch(err => console.error(err))
            .finally(() => process.exit(0));
    });
});
//# sourceMappingURL=reset-password.js.map