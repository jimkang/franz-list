/* global process, __dirname */
var test = require('tape');
var assertNoError = require('assert-no-error');
var ListService = require('../list-service');
var http = require('http');
var path = require('path');
var fs = require('fs');
var noThrowJSONParse = require('no-throw-json-parse');

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
fs.copyFileSync(initialStateStorePath, storePath);
initialStateStorePath, storePath;

var testCases = [
  {
    name: 'Add to list, starting without a token',
    subcases: [
      {
        name: 'Add to list without an email',
        method: 'GET',
        path: '/list/First test list/add',
        expectedStatusCode: 400,
        async customCheckResponse(t, res) {
          const body = await res.text();
          t.ok(
            body.includes('Provide an email to subscribe'),
            'Without email, an email form is presented.',
          );
        },
      },
      {
        name: 'Add to list',
        method: 'GET',
        path: '/list/First test list/add?email=smidgeo@fastmail.com',
        expectedStatusCode: 201,
        expectedMailCmdAddress: 'smidgeo@fastmail.com',
        expectedMailCmdStdIn: `Thanks for subscribing to First test list! To unsubscribe, click here: http://${serverHost}:${port}/list/First test list/remove?email=smidgeo@fastmail.com&token=pUtuZmLloZJUqccS`,

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
            'pUtuZmLloZJUqccS',
            'The token is in the store file.',
          );
        },
      },

      {
        name: 'Unsubscribe',
        method: 'GET',
        path: '/list/First test list/remove?email=smidgeo@fastmail.com&token=pUtuZmLloZJUqccS',
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
            'pUtuZmLloZJUqccS',
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
];

testCases.forEach(runTest);

function runTest(testCase) {
  test(testCase.name, testRequest);

  function testRequest(t) {
    var server;

    function MailSender() {
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
            t.equal(
              stdIn,
              expectedMailCmdStdIn,
              'Sent stdin content is correct.',
            );
          }
          queueMicrotask(done);
        },
      };
    }

    var mailSender = MailSender();
    ListService(
      {
        storePath,
        sendMail: mailSender.sendMail,
        seed: 'test-a',
        serviceBaseURL,
      },
      startServer,
    );

    function startServer(error, { app }) {
      assertNoError(t.ok, error, 'Service created.');
      if (error) {
        console.log('Error creating service:', error);
        process.exit();
      }
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
      if (theCase.expectedMailCmdAddress) {
        mailSender.setAddress(theCase.expectedMailCmdAddress);
      }
      if (theCase.expectedMailCmdStdIn) {
        mailSender.setStdIn(theCase.expectedMailCmdStdIn);
      }
      if (theCase.expectedMailCmdAddress || theCase.expectedMailCmdStdIn) {
        mailSender.setT(t);
      }

      const url = `http://${serverHost}:${port}${theCase.path}`;
      var reqOpts = {
        method: theCase.method,
      };
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

        if (theCase.customCheckResponse) {
          await theCase.customCheckResponse(t, res);
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
