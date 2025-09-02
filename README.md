## Cat-in-the-middle authentication

MiddleCat is an OIDC provider with a twist, designed specifically for simplifying the deployment of AMCAT.
It deviates a little bit from the standard OAuth2.0 / OIDC flows, in that it doesn't require clients to provide a client id and secret.
This allows it to work out-of-the-box for any AmCAT server and client.
The price for this is that it's not as secure as a full-featured provider like Auth0 or Keycloak, but we believe it's secure enough for the following use cases:

- You want to try out AmCAT first without going through the hassle of setting up a full OIDC provider
- You need a quick server for demos, tutorial or teaching
- Your data is not super sensitive

## Why you shouldn't be here

You probably don't want to set up a MiddleCat server yourself.
If you're using AmCAT, you can use our server at https://middlecat.net.
This does mean that you're trusting us to handle your authentication.
But if you are working with sensitive data that requires managing your authentication yourself, we recommend using a full-featured provider like Auth0 or Keycloak, as explained in the AmCAT documentation.

# Installation

MiddleCat is a NextJS app designed to be deployed on Cloudflare, which includes all the batteries and is easy to set up.
It's deployed on the edge, close to your users, and you don't have to manage any servers.
The database is a Cloudflare D1 database, which is a SQLite database in the cloud.
For a small server the free tier should be sufficient, and if you take the basic 5 bucks a month subscription you get a lot of extra capacity.

## Install dependencies

```
npm i
```

## Set the environment variables

We create a .env.local file for our settings, Identity providers and secrets.
The easiest way to create this is to run `npm run generate_env`, which will automatically
generate cryptographic secrets for you.

What you still need to do is to add the credentials for GitHub and Google login, and an SMTP server for email login.
For email we use resend. For a simple server the free tier should be sufficient.

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=[a big cryptographic pseudo random secret goes here]

NEXT_PUBLIC_PUBLICKEY="[public key goes here]"
PRIVATEKEY="[private key goes here]"

GITHUB_ID=
GITHUB_SECRET=

GOOGLE_ID=
GOOGLE_SECRET=

RESEND_API_KEY="..."
```

## Local development

For development we use miniflare to emulate the D1 database locally. If all is well, you should just be able to migrate out of the box.

```
npm run migrate:local
```

Now run the dev server

```
npm run dev
```

(note that in local development it's not possible to use the email login. Best way to test things is setting up the Google ID)


## Deploying to cloudflare


# Server-side implementation

To let a server use your Middlecat, it need to have an API endpoint that tells which Middlecat server it users, and validate Middlecat tokens using this Middlecat's public key. Specifically, you'll need to do the following:

- Create a **[server-api]/config** GET endpoint that returns a JSON object with (at least) a 'middlecat_url'. By providing this url, the server indicates that it trusts this MiddleCat server to sign it's access_tokens
- Obtain the **public_key** from this MiddleCat server. This can be obtained from **[middlecat]/api/configuration**, which returns a JSON object with (among other things) a **public_key**. The public key could change, so make sure to re-check routinely
- Use the public key to validate tokens from authenticated users. Requests will have an **Authorization** header with the value: **Bearer [access_token]**
- Also (!!) verify that the **resource** claim in the access_token is the current server. The resource (sometimes called **audience**) specifies the server for which the user authorized the client.
- Optionally, other claims can be used, e.g., to determine scope or block/only-allow certain clients.

# React clients

The current web clients for AmCAT are all written in React. We therefore provide a hook that makes it easy to setup a MiddleCat login. If you're already running MiddleCat, you can test the hook at **[middlecat]/demo_client**

First install the middlecat-sdk NPM module

```
npm install middlecat-sdk
```

Then use the hook to get a user and AuthForm component.

```
function Component() {
  const { user, AuthForm } = useMiddlecat();

  return <AuthForm />
}
```

The user object contains basic user details (email, name, image) and an Axios instance called 'api'. The Axios instance already has the base_url set to the host that a user connected to, and the access_token is added securely (insofar as possible) by intercepting the requests. Refresh token rotation is handled behind
the scenes, so the user.api should be all that you really need.

The AuthForm is a component for a Login/Logout screen. It is also possible to make a custom screen, for which useMiddlecat returns the signIn and signOut methods and a loading state.

By default, the refresh_token is not stored. This is safer, but has the downside that a user will have to authenticate for every new session (including refreshing the page and opening other tabs). A more convenient alternative is to set `useMiddlecat({storeToken: true})`. This stores the refresh token in localstorage. This is less secure because the tokens could be more easily stolen in case of a XSS attack, so it is not recommended if data is very sensitive. Also see the excellent explanation on [Auth0](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation) for some details on how refresh token rotation mitigates the risk somewhat. If you want both convenience and security, read on about using React with a (small, optionally stateless) backend.

## React with a samesite backend (e.g. NextJS)

We recommend that AmCAT clients use a fullstack framework like NextJS. Next to other (obvious?) benefits, this enables a third, more secure option that uses the backend as a proxy for the OAuth flow, and stores the refresh_token as a samesite httponly cookie. This means it won't be accessible from JS, and thereby safe(r) from XSS. To use this option, an API endpoint has to be made with the bffAuthHandler. In NextJS this would look as follows:

```
import { bffAuthHandler } from "middlecat-sdk";
import Cookies from "cookies";

export default async function handler(req, res) {
  const cookies = new Cookies(req, res);
  return await bffAuthHandler(req, res, cookies);
}
```

In the hook, you then set bff (backend-for-frontend) to the path of the endpoint: `useMiddlecat({bff: "/api/bffAuth"})`

# Building new clients (R, Python, etc.)

MiddleCat follows the OAuth2.0 protocol, which should have built in support in most programming environments. As an example we'll show how to do this with the httr2 package in R.

```
library(httr2)
library(glue)
```

The main input is the URL of the API server that we want to connect to.
The server will then provide all the details about what MiddleCat server to user.
If you do not have a server, you can user a demo server thats included in MiddleCat.

```
server = "https://middlecat.up.railway.app/api/demo_resource"
```

To get the server config, GET the config endpoint.

```
config = glue("{server}/config") |>
  request() |>
  req_perform() |>
  resp_body_json()

middlecat = config$middlecat_url
```

Now we can start the OAuth flow. The key information to provide is the
token and authentication endpoints. For middlecat these are:

- authorization: [middlecat_url]/authorize
- tokens: [middlecat_url]/api/token

```
auth_url = glue("{middlecat}/authorize")
token_url = glue("{middlecat}/api/token")
```

There are three main parameters/settings to set:

- **client_id**. The name of the application that is shown to the user in the authentication flow. If session_type is browser (the default) then this will automatically be set to the URL from which the request is made.
- **pkce**. MiddleCat requires using PKCE with the (standard) base64url encoded sha256 hash. httr2 supports this out of the box.
- **resource**. The call to auth_url should include the 'resource' parameter, which should be the
  URL of the AmCAT server.
- **refresh = "static"** (optional). This disables refresh token rotation, which does not yet seem to be supported by httr2.
- **session_type** (optional). Specify whether this is an "api_key" or "browser" session.

```
client_id = 'Some R package'
auth_params = list(resource=server, refresh="static")

client = oauth_client(id = client_id,
                      token_url = token_url)
tokens = oauth_flow_auth_code(client = client,
                              auth_url = auth_url,
                              pkce = TRUE,
                              auth_params = auth_params)
```

After completing the flow you should have an access_token and refresh_token.
You can use the access token as a bearer token to access the server API.
If you're using the MiddleCat Demo resource, you can use the /test endpoint.

```
glue("{server}/test") |>
  request() |>
  req_auth_bearer_token(tokens$access_token) |>
  req_perform() |>
  resp_body_string()
```

Finally, you will need to refresh your access_token when (or before) it expires.
This is also a standardized flow, and httr2 has a special function for it.

```
tokens = oauth_flow_refresh(client, tokens$refresh_token)
```

Note that this only works if refresh token rotation is disabled. Alternatively,
this step can be done manually, so that it does support token rotation.

```
body = list(grant_type = 'refresh_token',
            refresh_token = tokens$refresh_token)

tokens = request(token_url) |>
  req_body_json(body) |>
  req_perform() |>
  resp_body_json()
```
