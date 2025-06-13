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
        if (expectedMailCmdAddress) {
          t.equal(
            address,
            expectedMailCmdAddress,
            'Sent email address is correct.',
          );
        }
        if (expectedMailCmdStdIn) {
          t.equal(
            stdIn,
            expectedMailCmdStdIn,
            'Sent stdin content is correct.',
          );
        }
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

function TestMultiAddressMailSender() {
  var expectedMailCmdAddresses;
  var expectedMailCmdStdIn;
  var t;
  var addressesMailed = [];
  var failAddresses;

  return {
    setAddresses(addresses) {
      expectedMailCmdAddresses = addresses;
    },
    setStdIn(stdIn) {
      expectedMailCmdStdIn = stdIn;
    },
    setT(theT) {
      t = theT;
    },
    setFailureTriggeringAddresses(theFailAddresses) {
      failAddresses = theFailAddresses;
    },
    sendMail(address, stdIn, done) {
      if (failAddresses && failAddresses.includes(address)) {
        done(new Error(`Could not send email to ${address}`));
        return;
      }

      if (t) {
        addressesMailed.push(address);
        if (expectedMailCmdAddresses) {
          t.ok(
            expectedMailCmdAddresses.includes(address),
            'Sent email address is correct.',
          );
        }
        if (expectedMailCmdStdIn) {
          t.equal(
            stdIn,
            expectedMailCmdStdIn,
            'Sent stdin content is correct.',
          );
        }
      }
      queueMicrotask(done);
    },
    checkAllAddressesMailed() {
      t.deepEqual(
        addressesMailed.sort(),
        expectedMailCmdAddresses.sort(),
        'All addresses were mailed.',
      );
    },
  };
}

module.exports = {
  TestMailSender,
  DoNotCallMailSender,
  TestMultiAddressMailSender,
};
