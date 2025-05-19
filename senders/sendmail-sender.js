var child_process = require('child_process');

function sendMailWithSendmail(address, stdinContent, done) {
  var sendmailProc = child_process.exec(`sendmail ${address}`, done);
  sendmailProc.stdin.write(stdinContent);
  sendmailProc.stdin.end();
}

module.exports = { sendMailWithSendmail };
