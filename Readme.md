# ZAPI

ZAPI is an unofficial Zaad API.

## Why?

Zaad is a mobile payment product operated by Telesom in Somaliland. It allows users to send money and makes payments via
their mobile phone. Telesom has also provided a web interface for users to manage their Zaad account.

Telesom however does not provide an API for users to interact with their Zaad account. ZAPI fills this gap.

## How?

ZAPI essentially just does what a regular user would do when using the Zaad web interface. All operations by ZAPI simply
send GET or POST requests to the ZAAD web interface.

To use ZAPI, one requires their ZAAD account to have access to the web interface which is granted to users by Telesom
upon request.

Each operation done via ZAPI return a state object which contains information regarding the ZAPI's current session on
the Zaad web interface. You'll need to provide this state object to subsequent requests so that ZAPI can simulate the
experience of using the Zaad web interface.

## ZAPI Operations

Currently ZAPI supports the following operations:

 - getCaptcha
 - login (requires state and `getCaptcha` to have succeeded previously)
 - submitToken (requires state and `login` to have succeeded previously)
 - logout
 - getBalance (requires state and `submitToken` to have succeeded previously)
 - getRecentTransactions (requires state and `submitToken` to have succeeded previously)
 - sendMoney (requires state and `submitToken` to have succeeded previously)
 - sendMoneyConfirm (requires state and `sendMoney` to have succeeded previously)

### getCaptcha(state, cb)

This operation is used to fetch the captcha from the Zaad web interface.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `getCaptcha` operation is complete. It will get 3 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. A `captchaBuffer` which will be a Buffer containing the captcha image data if the operation was successful. It can be
sent with the MIME type 'image/jpeg'.

### login(credentials, state, cb)

This operation is used to submit the login credentials to access the Zaad web interface.

The `credentials` object should have a `phone`, `password` and `captcha` properties where the `phone` represents the
phone number associated with the user's Zaad account, the `password` is the password the user uses to log into the Zaad
web interface and the `captcha` being the captcha found in the last call to the `getCaptcha` operation.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `login` operation is complete. It will get 3 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. `loginSucceeded` will be a boolean that will be true if the login attempt succeeded and false otherwise.

Telesom implemented two-factor authentication on the Zaad web interface. If `loginSucceeded` is true, you should receive
a message on your phone that will contain a token. This token is used by ZAPI via the `submitToken` operation.

### submitToken(token, state, cb)

This operation is used to submit the token received on the phone after the `login` operation succeeds.

The `token` argument should be a string containing the token received on the phone.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `submitToken` operation is complete. It will get 3
arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. `wasTokenValid` will be a boolean that will be true if the token submission succeeded and false otherwise.

If `wasTokenValid` is true, ZAPI has successfully logged into the Zaad web interface. You will now be able to use the
operations that requires the login process to have been completed successfully.

### logout(state, cb)

This operation is used to make ZAPI logout of the Zaad web interface.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `logout` operation is complete. It will get 2 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.

### getBalance(state, cb)

This operation is used to fetch the user's current balance. Before using this operation, you will have had to have
completed the login process (which ends with a successful call of the `submitToken` operation).

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `getBalance` operation is complete. It will get 3
arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. The current `balance` of the user's account (if the operation is successful).

### getRecentTransactions(state, cb) DEPRECATED

This operation is used to fetch the user's last week's worth of transactions. Before using this operation, you will have
had to have completed the login process (which ends with a successful call of the `submitToken` operation).

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `getRecentTransactions` operation is complete. It will get
3 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. An array of `transactions`. Each element will be object with the following properties:

 - id: The transaction id
 - date: The transaction date
 - desc: The transaction description
 - type: The transaction type
 - ref: The reference of the transaction.
 - debit: The debit value of the transaction.
 - credit: The credit value of the transaction.
 - balance: The balance of the transaction.

The transactions are fetched from the "Account Activity" feature on the Zaad web interface.

### getTransactions(fromToRange, state, cb)

This operation is used to fetch the user's last week's worth of transactions. Before using this operation, you will have
had to have completed the login process (which ends with a successful call of the `submitToken` operation).

The `fromToRange` object should have `from` and `to` properties representing the date range of the transactions to
fetch. Both properties should be dates parsable by Date.parse.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `getRecentTransactions` operation is complete. It will get
3 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. An array of `transactions`. Each element will be object with the following properties:

 - id: The transaction id
 - date: The transaction date
 - desc: The transaction description
 - type: The transaction type
 - ref: The reference of the transaction.
 - debit: The debit value of the transaction.
 - credit: The credit value of the transaction.
 - balance: The balance of the transaction.

The transactions are fetched from the "Account Activity" feature on the Zaad web interface.

### sendMoney(transaction, state, cb)

This operation is used to send money from the user's account to a different Zaad account. Before using this operation, you
will have had to have completed the login process (which ends with a successful call of the `submitToken` operation).

The `transaction` argument should an object representing the details of the transaction. It should have a `phone`
property representing the Zaad account the money should be sent to and a `amount` property representing the amount of
money to send.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `getRecentTransactions` operation is complete. It will get
3 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. `wasTransactionSubmitted` will be a boolean that will be true if the transaction submission succeeded and false
otherwise.

If the transaction was successfully submitted; the money will not be sent to the recipient yet. A message will appear
on the user's phone that will be used to complete the transaction using the `sendMoneyConfirm` operation.

### sendMoneyConfirm(code, state, cb)

This operation is used to send money from the user's account to a different Zaad account. Before using this operation,
you will have had to have successfully called the `sendMoney` operation.

The `code` argument should be message that appeared on the user's phone after successfully completeing the `sendMoney`
operation.

The `state` argument should be the last state object received from a previous ZAPI operation or an empty object.

The `cb` argument is a function that will be called when the `getRecentTransactions` operation is complete. It will get
3 arguments:

1. An `err` value if an error occurs.
2. The new `state`. You should save this object for subsequent requests.
3. `wasTransactionConfirmed` will be a boolean that will be true if the transaction confirmation succeeded and false
otherwise.

If the transaction was successfully confirmed, a message should appear on the user's phone confirming the transaction
(just like how all successful transactions work on Zaad).

## Errors

If an error occurs, most `err` values returned from the operations will be an object. However, ZAPI's session to the
Zaad web interface times out, a string is returned the `err` value that says `"Session timed out"`.

## License

(The MIT License)

Copyright (c) 2014 Mustafa Saeed Haji Ali &lt;me@mustafasha.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
