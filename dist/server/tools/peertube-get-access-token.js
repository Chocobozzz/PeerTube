"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const index_1 = require("../tests/utils/index");
program
    .option('-u, --url <url>', 'Server url')
    .option('-n, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .parse(process.argv);
if (!program['url'] ||
    !program['username'] ||
    !program['password']) {
    if (!program['url'])
        console.error('--url field is required.');
    if (!program['username'])
        console.error('--username field is required.');
    if (!program['password'])
        console.error('--password field is required.');
    process.exit(-1);
}
index_1.getClient(program.url)
    .then(res => {
    const server = {
        url: program['url'],
        user: {
            username: program['username'],
            password: program['password']
        },
        client: {
            id: res.body.client_id,
            secret: res.body.client_secret
        }
    };
    return index_1.serverLogin(server);
})
    .then(accessToken => {
    console.log(accessToken);
    process.exit(0);
})
    .catch(err => {
    console.error(err);
    process.exit(-1);
});
//# sourceMappingURL=peertube-get-access-token.js.map