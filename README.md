# franz-list

A simple newsletter mailing list service that supports:

- Confirming subscriptions to a list via email
    - This works by generating a token for an email address, sending a link with that token to that email address, then allowing subscription if the token is including in the subscription request.
- Unsubscribing from a list
    - This also works via a token that the user gets in every email sent to them by the mailing list.
- Sending html emails to a mailing list with password auth

## Is it secure?

This app is not battle-tested nor meant for any application that deals with safety or money. It does make lazier vandals a little bit of work, though.

# Setup

- Fork this repo.
- Create a `.env` file containing the following variables:
    - STORE_PATH: that points to a JSON file that will serve as the store for the app.
        - There is an example store file in [tests/fixtures/test-store-a-initial-state.json].
    - SENDER_PASSWORD: The password you require a sender to the list to use.
    - SERVER_BASE_URL: The URL that the service will run at. Examples: `https://your-domain.wot/` or `https://who.dis/franz-list`.
    - JMAP_USERNAME: The sending email account username if you're sending mail via the Fastmail API.
    - JMAP_TOKEN: Your [API token], if you're sending mail via the Fastmail API.
- Edit `start-server.js` to pass the `sendMail` function of your choosing.
This repo provides a Fastmail one and sendmail one (that just shells out to the Unix `sendmail` command). If you want to create a new sender, implement a `sendMail` function with this signature: `function sendMailFn({ address, subject, message }, done)` where `done` is an error-first Node-style callback that takes an error as the first argument if there was a problem or `null` or `undefined` if there was not.
- Start the service with `make run`.

<br><br><br><br>

![Franz Liszt playing piano for friends.](franz-liszt-newsletter.png)
