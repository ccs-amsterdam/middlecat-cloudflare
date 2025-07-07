// experimental function for signing a token with a private key,
// that can be used to sign but not extracted
// https://pomcor.com/2017/06/02/keys-in-browser/

// The idea is that we can sign refresh tokens with this private key
// and provide MiddleCat beforehand with the public key during the OAuth 2.0 exchange.
// MiddleCat can then confirm that the refresh tokens were sent from the same
// browser that requested them.

// What this doesn't overcome is that someone with access to the JS might
// create the signed refresh token. But it does mitigate the issue of stealing
// refresh tokens from localStorage.

// alternatively, we could just encrypt refresh_tokens that are stored in localstorage,
// and use the public key to decrypt them before sending them to the server. Should be
// equally secure (protects agains non-custom XSS attacks).

export default function signToken() {
  return null;
}
