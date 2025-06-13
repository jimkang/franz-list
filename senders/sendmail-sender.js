var child_process = require('child_process');

function sendMailWithSendmail({ address, subject, message }, done) {
  var sendmailProc = child_process.exec(`/usr/sbin/sendmail ${address}`, done);
  const stdinContent = `From: bot@smidgeo.com
Subject: ${subject}

Content-Type: text/plain; charset=utf-8

${message}`;

  sendmailProc.stdin.write(stdinContent);
  sendmailProc.stdin.end();
}

module.exports = { sendMailWithSendmail };
