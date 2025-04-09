/* global process */
var test = require('tape');
var assertNoError = require('assert-no-error');
var ListService = require('../list-service');
var http = require('http');

const port = 5678;
const serverHost = process.env.SERVER || 'localhost';

var testCases = [
  {
    name: 'Show list without token',
    method: 'GET',
    path: '/list/1/show',
    expectedStatusCode: 404,
  },
];

testCases.forEach(runTest);

function runTest(testCase) {
  test(testCase.name, testRequest);

  function testRequest(t) {
    var server;

    ListService(startServer);

    function startServer(error, { app }) {
      assertNoError(t.ok, error, 'Service created.');
      if (error) {
        console.log('Error creating servce:', error);
        process.exit();
      }
      server = http.createServer(app);
      server.listen(port, runRequest);
    }

    function runRequest(error) {
      assertNoError(t.ok, error, 'Server started correctly.');
      const url = `http://${serverHost}:${port}${testCase.path}`;
      var reqOpts = {
        method: testCase.method,
      };
      fetch(url, reqOpts).then(checkResponse, onFetchFail);
    }

    function onFetchFail(error) {
      assertNoError(t.ok, error, 'No error while making request.');
    }
    function checkResponse(res) {
      t.equal(
        res.status,
        testCase.expectedStatusCode,
        'Correct status code is returned.',
      );
      // if (res.statusCode !== 200) {
      //   console.log('body:', body);
      // }
      server.close(t.end);
    }
  }
}
