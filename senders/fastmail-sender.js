/* global process */

async function getSession(headers, authUrl) {
  const response = await fetch(authUrl, {
    method: 'GET',
    headers,
  });
  return response.json();
}

async function mailboxQuery(headers, apiUrl, accountId) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        ['Mailbox/query', { accountId, filter: { name: 'Drafts' } }, 'a'],
      ],
    }),
  });
  const data = await response.json();

  return await data['methodResponses'][0][1].ids[0];
}

async function identityQuery(headers, username, apiUrl, accountId) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      using: [
        'urn:ietf:params:jmap:core',
        'urn:ietf:params:jmap:mail',
        'urn:ietf:params:jmap:submission',
      ],
      methodCalls: [['Identity/get', { accountId, ids: null }, 'a']],
    }),
  });
  const data = await response.json();

  return await data['methodResponses']?.[0]?.[1]?.list?.filter(
    (identity) => identity.email === username,
  )?.[0]?.id;
}

async function draftResponse({
  headers,
  username,
  to,
  apiUrl,
  accountId,
  draftId,
  identityId,
  messageBody,
}) {
  const draftObject = {
    from: [{ email: username }],
    to: [{ email: to }],
    subject: 'Hello, world!',
    keywords: { $draft: true },
    mailboxIds: { [draftId]: true },
    bodyValues: { body: { value: messageBody, charset: 'utf-8' } },
    textBody: [{ partId: 'body', type: 'text/plain' }],
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      using: [
        'urn:ietf:params:jmap:core',
        'urn:ietf:params:jmap:mail',
        'urn:ietf:params:jmap:submission',
      ],
      methodCalls: [
        ['Email/set', { accountId, create: { draft: draftObject } }, 'a'],
        [
          'EmailSubmission/set',
          {
            accountId,
            onSuccessDestroyEmail: ['#sendIt'],
            create: { sendIt: { emailId: '#draft', identityId } },
          },
          'b',
        ],
      ],
    }),
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));

  // TODO: What else do we neet to look for in this response?
  for (let entry of data.methodResponses) {
    const method = entry?.[0];
    let res = entry?.[1];
    if (res?.notCreated) {
      throw new Error(
        `${method} response notCreated: ${JSON.stringify(res.notCreated)}`,
      );
    }
  }
}

async function sendMailWithFastmail({ address, message }, done) {
  if (!process.env.JMAP_USERNAME || !process.env.JMAP_TOKEN) {
    done(
      new Error('JMAP_USERNAME or JMAP_TOKEN environment variable not set.'),
    );
    return;
  }

  const hostname = process.env.JMAP_HOSTNAME || 'api.fastmail.com';
  const username = process.env.JMAP_USERNAME;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.JMAP_TOKEN}`,
  };
  const authUrl = `https://${hostname}/.well-known/jmap`;

  try {
    const session = await getSession(headers, authUrl);
    const apiUrl = session.apiUrl;
    const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail'];
    const draftId = await mailboxQuery(headers, apiUrl, accountId);
    const identityId = await identityQuery(
      headers,
      username,
      apiUrl,
      accountId,
    );
    await draftResponse({
      headers,
      username,
      to: address,
      apiUrl,
      accountId,
      draftId,
      identityId,
      messageBody: message,
    });
    done();
  } catch (error) {
    done(error);
  }
}

module.exports = { sendMailWithFastmail };
