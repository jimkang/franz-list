# franz-list

This is a service that maintains a text file containing a JSON list via "magic link" auth. Each record in the list can contain any number of fields, but they must all have these two:

- id: This is a unique identifier for the field.
- email: This is the email which will be used to verify that changes can be made to the entry.

When a client requests a change to a record, the service first emails a key to the email for that record. The user can then use that key to make a second request with that key. The key will expire after a set amount of time.

## Is it secure?

This app is not battle-tested nor meant for any application that deals with safety or money. It does provide deterrence against the lazier vandals, though.

# Setup

- Create a `.env` file containing a STORE_PATH that points to a JSON file that will serve as the store for the app.
- There is an example store file in [tests/fixtures/test-store-a-initial-state.json].

## TODO

- Run it for real?
