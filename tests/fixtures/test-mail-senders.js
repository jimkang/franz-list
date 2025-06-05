function TestMailSender() {
  var expectedMailCmdAddress;
  var expectedMailCmdStdIn;
  var t;

  return {
    setAddress(address) {
      expectedMailCmdAddress = address;
    },
    setStdIn(stdIn) {
      expectedMailCmdStdIn = stdIn;
    },
    setT(theT) {
      t = theT;
    },
    sendMail(address, stdIn, done) {
      if (t) {
        t.equal(
          address,
          expectedMailCmdAddress,
          'Sent email address is correct.',
        );
        t.equal(stdIn, expectedMailCmdStdIn, 'Sent stdin content is correct.');
      }
      queueMicrotask(done);
    },
  };
}

function DoNotCallMailSender() {
  var t;

  return {
    setAddress() {},
    setStdIn() {},
    setT(theT) {
      t = theT;
    },
    sendMail(address, stdIn, done) {
      if (t) {
        t.fail('sendMail is not called.');
      }
      queueMicrotask(done);
    },
  };
}

module.exports = { TestMailSender, DoNotCallMailSender };
