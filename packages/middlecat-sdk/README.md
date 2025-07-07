# Using Middlecat Authentication in React

This is a hook for using MiddleCat authentication. See the [ccs-amsterdam/middlecat](https://github.com/ccs-amsterdam/middlecat) repository for details about what on earth Middlecat is supposed to be.

# Using the hook

First install the middlecat-sdk NPM module

```
npm install middlecat-sdk
```

Then wrap the component tree that uses middlecat with the middlecat provider.
You can provide general settings as props. In this example we use bff (backend-for-frontend) to set the
API path to proxy interaction with MiddleCat, for safer storage of tokens.

```
import {  MiddlecatProvider } from "middlecat-sdk";

export default function Example() {
  return (
    <MiddlecatProvider>
      <YourApp />
    </MiddlecatProvider>
  );
}
```

Now you can use useMiddlecat inside the provider to get the user.
For actions like signing in and out, you can either get the signIn and signOut functions from useMiddlecat, or
use the AuthForm component.

```
import { useMiddlecat, AuthForm } from "middlecat-sdk";

function Component() {
  const { user, loading, error, signIn, signOut, signInGuest } = useMiddlecat();

  return <AuthForm />
}
```

The user object contains basic user details (email, name, image) and an Axios instance called 'api'. The Axios instance already has the base_url set to the host that a user connected to, and the access_token is added securely (insofar as possible) by intercepting the requests. Refresh token rotation is handled behind
the scenes, so the user.api should be all that you really need.

The AuthForm is a component for a Login/Logout screen. It is also possible to make a custom screen, for which useMiddlecat returns the signIn and signOut methods and a loading state.

By default, the refresh_token is not stored. This is safer, but has the downside that a user will have to authenticate for every new session (including refreshing the page and opening multiple tabs). A more convenient alternative is to set storeToken to true in the MiddlecatProvider (`<MiddlecatProvider storeToken={true}`). This stores the refresh token in localstorage. This is less secure because the tokens could be more easily stolen in case of a XSS attack, so it is not recommended if data is sensitive. Also see the excellent explanation on [Auth0](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation) for some details on how refresh token rotation mitigates the risk somewhat. If you want both convenience and security, read on about using React with a (small, optionally stateless) backend.

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

To use this proxy, set the API path in the bff prop of the MiddleCat provider: `<MiddlecatProvider bff=/api/bffAuth`.
