function TestMailSender() {
  var expectedMailAddress;
  var expectedMailSubject;
  var expectedMailMessage;
  var t;

  return {
    setAddress(address) {
      expectedMailAddress = address;
    },
    setSubject(subject) {
      expectedMailSubject = subject;
    },
    setMessage(message) {
      expectedMailMessage = message;
    },
    setT(theT) {
      t = theT;
    },
    sendMail({ address, subject, message }, done) {
      if (t) {
        if (expectedMailAddress) {
          t.equal(
            address,
            expectedMailAddress,
            'Sent email address is correct.',
          );
        }
        if (expectedMailSubject) {
          t.equal(subject, expectedMailSubject, 'Sent subject is correct.');
        }
        if (expectedMailMessage) {
          t.equal(message, expectedMailMessage, 'Sent message is correct.');
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
    setSubject() {},
    setMessage() {},
    setT(theT) {
      t = theT;
    },
    sendMail(opts, done) {
      if (t) {
        t.fail('sendMail is not called.');
      }
      queueMicrotask(done);
    },
  };
}

function TestMultiAddressMailSender() {
  var expectedMailAddresses;
  var expectedMailSubject;
  var expectedMailMessageRegex;
  var t;
  var addressesMailed = [];
  var failAddresses;

  return {
    setAddresses(addresses) {
      expectedMailAddresses = addresses;
    },
    setSubject(subject) {
      expectedMailSubject = subject;
    },
    setMessageRegex(messageRegex) {
      expectedMailMessageRegex = messageRegex;
    },
    setT(theT) {
      t = theT;
    },
    setFailureTriggeringAddresses(theFailAddresses) {
      failAddresses = theFailAddresses;
    },
    sendMail({ address, subject, message }, done) {
      if (failAddresses && failAddresses.includes(address)) {
        done(new Error(`Could not send email to ${address}`));
        return;
      }

      if (t) {
        addressesMailed.push(address);
        if (expectedMailAddresses) {
          t.ok(
            expectedMailAddresses.includes(address),
            'Sent email address is correct.',
          );
        }
        if (expectedMailSubject) {
          t.equal(subject, expectedMailSubject, 'Sent subject correct.');
        }
        if (expectedMailMessageRegex) {
          t.ok(
            expectedMailMessageRegex.test(message),
            'Sent message is correct.',
          );
        }
      }
      queueMicrotask(done);
    },
    checkAllAddressesMailed() {
      t.deepEqual(
        addressesMailed.sort(),
        expectedMailAddresses.sort(),
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
