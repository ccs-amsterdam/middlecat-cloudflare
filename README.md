## Cat-in-the-middle authentication

MiddleCat is an identity provider with a designed specifically for simplifying the deployment of AMCAT.
It deviates a little bit from the standard OAuth2.0 / OIDC flows, in that it doesn't require clients to provide a client id and secret.
This allows it to work out-of-the-box for any AmCAT server and client.
The price for this is that it's not as secure as an audited OIDC identity provider, but we believe it's secure enough for the following use cases:

- You want to try out AmCAT first without going through the hassle of setting up a full OIDC provider
- You need a quick server for demos, tutorial or teaching
- Your data is not super sensitive

If you are working with sensitive data, and/or are required to meet specific compliance obligations like SOC 2, HIPAA, or ISO 27001, you should instead configure AmCAT to work with an established OIDC provider like Auth0 or Keycloak.

## Why you maybe shouldn't be here

You probably don't want to set up a MiddleCat server yourself.
If you're using AmCAT, you can use our server at https://middlecat.net.
This does mean that you're trusting us to handle your authentication.

If you don't trust us (I mean, I get it...), rather than setting up your own MiddleCat server, it will often be easier and better to set up a full-featured OIDC provider like Auth0 or Keycloak.

Running your own MiddleCat server is an edge case, where you do want a quick and easy authentication server for your own AmCAT deployments, but you don't want to use our server.

Really, the main reason this repository is here at all is that on the off chance that I get eaten by my cats, I want to make sure that people can still run MiddleCat.


# Installation

MiddleCat is a NextJS app designed to be deployed on Cloudflare.
Cloudflare works well for this because it's fast, cheap and easy, and includes most of the batteries you need.
For a small server the free tier should be sufficient, and if you take the basic 5 bucks a month subscription you'll have more than enough resources for a large number of users.

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

To let a server (like AmCAT) use Middlecat, it need to have an API endpoint that tells which Middlecat server it users, and validate Middlecat tokens using this Middlecat's public key. Specifically, you'll need to do the following:

- Create a **[server-api]/config** GET endpoint that returns a JSON object with (at least) a 'middlecat_url'. By providing this url, the server indicates that it trusts this MiddleCat server to sign it's access_tokens
- Obtain the **public_key** from this MiddleCat server. This can be obtained from **[middlecat]/api/configuration**, which returns a JSON object with (among other things) a **public_key**. The public key could change, so make sure to re-check routinely
- Use the public key to validate tokens from authenticated users. Requests will have an **Authorization** header with the value: **Bearer [access_token]**
- Also (!!) verify that the **resource** claim in the access_token is the current server. The resource (sometimes called **audience**) specifies the server for which the user authorized the client.
- Optionally, other claims can be used, e.g., to determine scope or block/only-allow certain clients.

## Server-side implementation with OIDC

To make your server also support other OIDC providers, you can add a "oidc_url" to the /config endpoint. This should be the URL of the OIDC provider. The AmCAT clients



# Clients

MiddleCat supports the standard OAuth2.0 flows.
Any self-respecting programming language should have libraries that support this.
Below we have an example for R, using the `httr2` package.

For web clients we strongly recommend using a fullstack application that can handle the OAuth flow on the backend, and store the refresh_token as a samesite httponly cookie.
The demo_client in this repository shows how to do this with NextJS.

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

## R client example

This is how you could implement MiddleCat authentication in an R client, using the `httr2` package.

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
