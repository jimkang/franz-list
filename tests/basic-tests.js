/* global process, __dirname */
var test = require('tape');
var assertNoError = require('assert-no-error');
var ListService = require('../list-service');
var http = require('http');
var path = require('path');
var fs = require('fs');
var noThrowJSONParse = require('no-throw-json-parse');
var {
  TestMailSender,
  DoNotCallMailSender,
  TestMultiAddressMailSender,
} = require('./fixtures/test-mail-senders');

const port = 5678;
const serverHost = process.env.SERVER || 'localhost';
const serviceBaseURL = `http://${serverHost}:${port}`;

const initialStateStorePath = path.join(
  __dirname,
  'fixtures/test-store-a-initial-state.json',
);
// Copy initial state of store to working copy.
const storePath = initialStateStorePath.replace(
  'initial-state',
  'working-copy',
);

const expectedToken = 'pUtuZmLloZJUqccS';

var messageRegexListA = [
  /Yo, this is a message for the whole list\./,
  /This is a message from the First test list mailing list\./,
  /<a href="http:\/\/localhost:5678\/list\/First test list\/remove\?email=\w+@\w+\.\w+&token=\w{16}">Unsubscribe<\/a>/,
  /To invite someone to subscribe, send them to: <a href="http:\/\/localhost:5678\/signup\?list=First test list">/,
];

var testCases = [
  {
    name: 'Add to list, starting without a token',
    subcases: [
      {
        name: 'Add to list without an email',
        method: 'GET',
        path: '/list/First test list/add',
        expectedStatusCode: 200,
        async customCheckResponse(t, res) {
          const body = await res.text();
          t.ok(
            body.includes('<button id="subscribe-button">Subscribe</button>'),
            'Without email, an email form is presented.',
          );
        },
      },
      {
        name: 'Add to list',
        method: 'GET',
        path: '/list/First test list/add?email=smidgeo@fastmail.com',
        expectedStatusCode: 201,
        expectedMailAddress: 'smidgeo@fastmail.com',
        expectedMailSubject: 'First test list subscription',
        expectedMailMessage: `You have subscribed to the First test list newsletter!<br>To unsubscribe, <a href="http://${serverHost}:${port}/list/First test list/remove?email=smidgeo@fastmail.com&token=${expectedToken}">click here</a>.`,

        async customCheckResponse(t, res) {
          const body = await res.text();
          t.ok(
            body.includes(
              'You have successfully subscribed to First test list',
            ),
            'The user is able to subscribe.',
          );

          var storeCopy = noThrowJSONParse(
            fs.readFileSync(storePath, { encoding: 'utf8' }),
            {},
          );

          t.ok(
            storeCopy.lists['First test list'].subscribers.includes(
              'smidgeo@fastmail.com',
            ),
            "The store now has the email in the list's subscribers.",
          );

          t.deepEqual(
            storeCopy.tokensForUsers['smidgeo@fastmail.com'].token,
            expectedToken,
            'The token is in the store file.',
          );
        },
      },

      {
        name: 'Attempt to add email already in list to list',
        method: 'GET',
        path: '/list/First test list/add?email=smidgeo@fastmail.com',
        MailSenderCtor: DoNotCallMailSender,
        expectedStatusCode: 202,
        // expectedMailAddress: 'smidgeo@fastmail.com',
        // expectedMailSubject: `You are already subscribed to First test list! To unsubscribe, click here: http://${serverHost}:${port}/list/First test list/remove?email=smidgeo@fastmail.com&token=${expectedToken}`,

        async customCheckResponse(t, res) {
          const body = await res.text();
          t.ok(
            body.includes('You have already subscribed to First test list'),
            'The user is informed that they are subscribed.',
          );

          var storeCopy = noThrowJSONParse(
            fs.readFileSync(storePath, { encoding: 'utf8' }),
            {},
          );

          t.equal(
            storeCopy.lists['First test list'].subscribers.filter(
              (email) => email === 'smidgeo@fastmail.com',
            ).length,
            1,
            "The store has the email in the list's subscribers only once.",
          );

          t.deepEqual(
            storeCopy.tokensForUsers['smidgeo@fastmail.com'].token,
            expectedToken,
            'The token is in the store file.',
          );
        },
      },

      {
        name: 'Unsubscribe',
        method: 'GET',
        path: `/list/First test list/remove?email=smidgeo@fastmail.com&token=${expectedToken}`,
        expectedStatusCode: 201,
        async customCheckResponse(t, res) {
          const body = await res.text();
          t.ok(
            body.includes(
              'You have successfully unsubscribed from First test list',
            ),
            'With token, the user is able to unsubscribe.',
          );

          var storeCopy = noThrowJSONParse(
            fs.readFileSync(storePath, { encoding: 'utf8' }),
            {},
          );

          t.ok(
            !storeCopy.lists['First test list'].subscribers.includes(
              'smidgeo@fastmail.com',
            ),
            "The store no longer has the email in the list's subscribers.",
          );
          storeCopy = noThrowJSONParse(
            fs.readFileSync(storePath, { encoding: 'utf8' }),
            {},
          );

          t.equal(
            storeCopy.tokensForUsers['smidgeo@fastmail.com'].token,
            expectedToken,
            'The token is still in the store file.',
          );
          t.ok(
            !storeCopy.lists['First test list'].subscribers.includes(
              'smidgeo@fastmail.com',
            ),
            "The email is no longer in the list's subscribers in the store file.",
          );
        },
      },
    ],
  },
  {
    name: 'Send to list with bad password',
    method: 'POST',
    path: '/send',
    headers: {
      Authorization: 'Bearer wrong-password',
    },
    body: {
      listId: 'First test list',
      subject: 'Hey',
      message: 'Yo, this is a message for the whole list.',
    },
    MailSenderCtor: DoNotCallMailSender,
    expectedStatusCode: 401,
  },
  {
    name: 'Send to list successfully',
    subcases: [
      {
        name: 'Add to list (less thorough test)',
        method: 'GET',
        path: '/list/First test list/add?email=smidgeo@fastmail.com',
        expectedStatusCode: 201,
        expectedMailAddress: 'smidgeo@fastmail.com',
      },
      {
        name: 'Add to list (less thorough test)',
        method: 'GET',
        path: '/list/First test list/add?email=drwily@fastmail.com',
        expectedStatusCode: 201,
        expectedMailAddress: 'drwily@fastmail.com',
      },
      {
        name: 'Send to list with correct password',
        method: 'POST',
        path: '/send',
        headers: {
          Authorization: `Bearer ${process.env.SENDER_PASSWORD}`,
        },
        body: {
          listId: 'First test list',
          subject: 'Hey',
          message: 'Yo, this is a message for the whole list.',
        },
        MailSenderCtor: TestMultiAddressMailSender,
        expectedAddresses: ['smidgeo@fastmail.com', 'drwily@fastmail.com'],
        expectedStatusCode: 200,
        expectedMailSubject: 'Hey',
        expectedMailMessageRegexeses: messageRegexListA,
      },
    ],
  },
  {
    name: 'Send to list with a bad email address',
    subcases: [
      {
        name: 'Add to list (less thorough test)',
        method: 'GET',
        path: '/list/First test list/add?email=smidgeo@fastmail.com',
        expectedStatusCode: 201,
        expectedMailAddress: 'smidgeo@fastmail.com',
      },
      {
        name: 'Add to list (less thorough test)',
        method: 'GET',
        path: '/list/First test list/add?email=drwilyyy@fastmail.com',
        expectedStatusCode: 201,
        expectedMailAddress: 'drwilyyy@fastmail.com',
      },
      {
        name: 'Send to list',
        method: 'POST',
        path: '/send',
        headers: {
          Authorization: `Bearer ${process.env.SENDER_PASSWORD}`,
        },
        body: {
          listId: 'First test list',
          subject: 'Hey',
          message: 'Yo, this is a message for the whole list.',
        },
        MailSenderCtor: TestMultiAddressMailSender,
        failAddresses: ['drwilyyy@fastmail.com'],
        expectedAddresses: ['smidgeo@fastmail.com'],
        expectedStatusCode: 500,
        expectedResponseText:
          'Could not send to all subscribers. The following errors were encountered:\nCould not send email to drwilyyy@fastmail.com',
        expectedMailSubject: 'Hey',
        expectedMailMessageRegexeses: messageRegexListA,
      },
    ],
  },
];

testCases.forEach(runTest);

function runTest(testCase) {
  test(testCase.name, testRequest);

  function testRequest(t) {
    fs.copyFileSync(initialStateStorePath, storePath);

    var server;
    var setSendEmailFn;

    var mailSender = TestMailSender();
    ListService(
      {
        storePath,
        sendMail: mailSender.sendMail,
        seed: 'test-a',
        serviceBaseURL,
      },
      startServer,
    );

    function startServer(error, { app, setSendEmail }) {
      assertNoError(t.ok, error, 'Service created.');
      if (error) {
        console.log('Error creating service:', error);
        process.exit();
      }
      setSendEmailFn = setSendEmail;
      server = http.createServer(app);
      server.listen(port, runRequest);
    }

    async function runRequest(error) {
      assertNoError(t.ok, error, 'Server started correctly.');
      if (testCase.subcases) {
        for (let subcase of testCase.subcases) {
          await runCase(subcase);
        }
      } else {
        await runCase(testCase);
      }
      // Sadly, I guess the server takes a while to close.
      server.close(() => setTimeout(t.end, 100));
    }
    async function runCase(theCase) {
      var caseMailSender = mailSender;
      if (theCase.MailSenderCtor) {
        caseMailSender = theCase.MailSenderCtor();
        caseMailSender.setT(t);
        setSendEmailFn(caseMailSender.sendMail);
      }

      if (theCase.expectedMailAddress) {
        caseMailSender.setAddress(theCase.expectedMailAddress);
      }
      if (theCase.expectedMailSubject) {
        caseMailSender.setSubject(theCase.expectedMailSubject);
      }
      if (theCase.expectedMailMessage) {
        caseMailSender.setMessage(theCase.expectedMailMessage);
      }
      if (theCase.expectedMailMessageRegexes) {
        caseMailSender.setMessageRegexes(theCase.expectedMailMessageRegex);
      }
      if (
        theCase.expectedMailAddress ||
        theCase.expectedAddresses ||
        theCase.expectedMailSubject ||
        theCase.expectedMailMessage ||
        theCase.expectedMailMessageRegexes
      ) {
        caseMailSender.setT(t);
      }
      if (theCase.expectedAddresses) {
        caseMailSender.setAddresses(theCase.expectedAddresses);
      }
      if (theCase.failAddresses) {
        caseMailSender.setFailureTriggeringAddresses(theCase.failAddresses);
      }

      const url = `http://${serverHost}:${port}${theCase.path}`;
      var reqOpts = {
        method: theCase.method,
      };
      if (theCase.headers) {
        reqOpts.headers = theCase.headers;
      }
      if (theCase.body) {
        reqOpts.body = JSON.stringify(theCase.body);
        reqOpts.headers['Content-Type'] = 'application/json';
      }

      try {
        var res = await fetch(url, reqOpts);
        checkResponse(res);
      } catch (error) {
        onFetchFail(error);
      }

      async function checkResponse(res) {
        console.log('## Testing subcase:', theCase.name);
        t.equal(
          res.status,
          theCase.expectedStatusCode,
          'Correct status code is returned.',
        );

        if (theCase.expectedResponseText) {
          t.equal(
            await res.text(),
            theCase.expectedResponseText,
            'Response text is correct.',
          );
        }

        if (theCase.customCheckResponse) {
          await theCase.customCheckResponse(t, res);
        }
        if (caseMailSender?.checkAllAddressesMailed) {
          caseMailSender.checkAllAddressesMailed();
        }
        // if (res.statusCode !== 200) {
        //   console.log('body:', body);
        // }
      }
    }

    function onFetchFail(error) {
      assertNoError(t.ok, error, 'No error while making request.');
    }
  }
}
