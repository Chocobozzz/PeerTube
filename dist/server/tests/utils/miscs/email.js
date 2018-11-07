"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MailDev = require("maildev");
function mockSmtpServer(emailsCollection) {
    const maildev = new MailDev({
        ip: '127.0.0.1',
        smtp: 1025,
        disableWeb: true,
        silent: true
    });
    maildev.on('new', email => emailsCollection.push(email));
    return new Promise((res, rej) => {
        maildev.listen(err => {
            if (err)
                return rej(err);
            return res();
        });
    });
}
exports.mockSmtpServer = mockSmtpServer;
//# sourceMappingURL=email.js.map