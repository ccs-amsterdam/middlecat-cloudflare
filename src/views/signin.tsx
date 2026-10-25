import { EnvelopeIcon, GithubIcon, GoogleIcon } from "./icons";

interface Props {
  providers: { email: boolean; github: boolean; google: boolean };
  /** where to go after signing in (relative path) */
  callbackURL: string;
  error?: string;
  /** shown above the buttons, e.g. why the user has to sign in again */
  notice?: string;
}

/** Sign-in buttons. Behaviour is in /signin.js */
export function SignIn({ providers, callbackURL, error, notice }: Props) {
  const none = !providers.email && !providers.github && !providers.google;
  return (
    <div class="SignInForm" id="signin" data-callback-url={callbackURL}>
      {notice ? <p class="SignInNotice">{notice}</p> : null}
      <div class="SignInProviders" id="signin-providers">
        <h2>Sign in with</h2>
        {none ? <p>No login providers are configured.</p> : null}
        {providers.email ? (
          <button type="button" class="ProviderButton" id="signin-email-open">
            <span>Email</span>
            <div class="Logo">
              <EnvelopeIcon />
            </div>
          </button>
        ) : null}
        {providers.github ? (
          <button type="button" class="ProviderButton" data-provider="github">
            <span>GitHub</span>
            <div class="Logo">
              <GithubIcon />
            </div>
          </button>
        ) : null}
        {providers.google ? (
          <button type="button" class="ProviderButton" data-provider="google">
            <span>Google</span>
            <div class="Logo">
              <GoogleIcon />
            </div>
          </button>
        ) : null}
      </div>

      {providers.email ? (
        <div class="EmailLogin hidden" id="signin-email">
          <h2>Email login</h2>
          <form class="EmailForm" id="signin-email-form">
            <div class="EmailInput">
              <input type="email" id="email" name="email" placeholder="example@email.com" required />
            </div>
            <button type="submit" class="ProviderButton">
              <div class="Logo">
                <EnvelopeIcon />
              </div>
              <span>Send magic link</span>
            </button>
            <div>
              <button type="button" class="Back" id="signin-email-back">
                Go back
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div class={error ? "SignInError" : "SignInError hidden"} id="signin-error">
        {error}
      </div>
    </div>
  );
}
