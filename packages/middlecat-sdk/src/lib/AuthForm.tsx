import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { MiddlecatUser } from "./types";
import { prepareURL } from "./util";
import { useMiddlecat } from "./MiddlecatProvider";

interface LayoutProps {
  primary?: string;
  secondary?: string;
  fontSize?: string;
}

const AuthContainer = styled.div<LayoutProps>`
  --primary: ${(p) => p.primary || "#38c7b9"};
  --secondary: ${(p) => p.secondary || "#1d7269"};

  color: var(--secondary);
  display: flex;
  text-align: center;
  flex-direction: column;
  position: relative;
  font-size: ${(p) => p.fontSize || "1.4em"};

  .InnerContainer {
    box-sizing: border-box;
    font-size: 1.2em;
    margin: auto;
    width: 100%;
    max-width: 400px;
    text-align: center;
  }

  .User {
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 800;
  }

  .Image {
    height: 45px;
    width: 45px;
    border-radius: 50%;
    margin-right: 1rem;
    border: 1px solid var(--secondary);
  }
  button {
    width: 100%;
    color: black;
    background: white;
    border: 2px solid var(--primary);
    font-size: inherit;
    max-width: 400px;
    padding: 0.6rem 1.5rem;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.3s;

    &:hover:enabled {
      color: white;
      background: var(--primary);
    }
  }

  input {
    margin: 1rem 0rem;
    width: 100%;
    border-radius: 5px;
    height: 40px;
    padding: 10px 10px 10px 10px;
    font-size: inherit;
    background: white;
  }
  .SignOut {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .Loader {
    margin: auto;
    border: 10px solid #f3f3f3;
    border-top: 10px solid var(--secondary);
    border-radius: 50%;
    width: 80px;
    height: 80px;
    animation: spin 1s linear infinite, delayedFadeIn 1s linear;
  }

  .ResourceLabel {
    line-height: 3rem;
  }

  p {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    height: 3rem;
  }

  .Divider {
    display: flex;
    position: relative;
    margin: 1rem 10px;
    z-index: 2;
  }

  .Divider div {
    margin: auto;
    background: white;
    z-index: 2;
    padding: 0rem 1rem;
    font-size: 0.9em;
  }

  .Divider::after {
    content: "";
    position: absolute;
    bottom: 1rem;
    left: 0;
    width: 100%;
    z-index: 1;
    border-bottom: 2px solid;
  }
`;

interface AuthFormProps {
  primary?: string;
  secondary?: string;
  fontSize?: string;
  resourceExample?: string;
  resourceSuggestion?: string;
  resourceFixed?: string;
  resourceRequired?: boolean;
  signInTitle?: string;
  signOutTitle?: string;
  signInButtonLabel?: string;
  signOutButtonLabel?: string;
}

export default function AuthForm({
  primary,
  secondary,
  fontSize,
  resourceExample,
  resourceSuggestion,
  resourceFixed,
  resourceRequired,
  signInTitle,
  signOutTitle,
  signInButtonLabel,
  signOutButtonLabel,
}: AuthFormProps) {
  const { user, loading, error, fixedResource, signIn, signInGuest, signOut } =
    useMiddlecat();

  function ConditionalRender() {
    if (loading) return <div className="Loader" />;
    if (!user)
      return (
        <SignInForm
          signIn={signIn}
          signInGuest={signInGuest}
          resourceExample={resourceExample}
          resourceSuggestion={resourceSuggestion}
          resourceFixed={fixedResource || resourceFixed}
          resourceRequired={resourceRequired}
          signInTitle={signInTitle}
          signInButtonLabel={signInButtonLabel}
        />
      );
    return (
      <SignOutForm
        user={user}
        resourceFixed={fixedResource || resourceFixed}
        signIn={signIn}
        signOut={signOut}
        signOutTitle={signOutTitle}
        signOutButtonLabel={signOutButtonLabel}
      />
    );
  }

  return (
    <AuthContainer fontSize={fontSize} primary={primary} secondary={secondary}>
      <div className="InnerContainer">
        <ConditionalRender />
      </div>
      {user ? null : <p>{error}</p>}
    </AuthContainer>
  );
}

interface SignInFormProps {
  signIn: (resource: string, middlecat_url?: string) => Promise<void>;
  signInGuest: (resource: string, middlecat_url?: string) => Promise<void>;
  resourceExample?: string;
  resourceSuggestion?: string;
  resourceFixed?: string;
  resourceRequired?: boolean;
  signInTitle?: string;
  signInButtonLabel?: string;
}

// interface ResourceConfig {
//   resource: string;
//   middlecat_url: string;
//   allow_guests: boolean;
// }

function SignInForm({
  signIn,
  signInGuest,
  resourceExample,
  resourceSuggestion,
  resourceFixed,
  resourceRequired,
  signInTitle,
  signInButtonLabel,
}: SignInFormProps) {
  const [resourceValue, setResourceValue] = useState(
    resourceFixed ||
      sessionStorage.getItem("AuthformResource") ||
      resourceSuggestion ||
      ""
  );
  //   const [config, setConfig] = useState<ResourceConfig>();
  const [error, setError] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);

  const onSubmit = useCallback(
    async (e: any) => {
      e.preventDefault();
      setLoadingConfig(true);
      signInGuest(resourceValue).finally(() => setLoadingConfig(false));
      // DEPRECATED: NO LONGER AUTO LOGIN. jUST ALWAYS CONNECT AS GUEST FIRST
      // let res;
      // try {
      //   res = await axios.get(`${prepareURL(resourceValue)}/config`, {
      //     timeout: 5000,
      //   });
      // } catch (e) {
      //   console.error(e);
      // }

      // if (!res || res.status !== 200) {
      //   setError("Could not connect to server");
      //   setLoadingConfig(false);
      //   return;
      // }

      // const auth = res.data.authorization || "allow_guests";

      // const middlecat_url = res.data.middlecat_url || "";
      // const allow_guests = auth === "allow_guests";

      // if (auth === "no_auth") {
      //   signInGuest(resourceValue, true, middlecat_url);
      // } else if (!allow_guests && !middlecat_url) {
      //   setError("Server has invalid authentication configuration");
      // } else if (!allow_guests && middlecat_url) {
      //   signIn(resourceValue, middlecat_url);
      // } else if (allow_guests) {
      //   signInGuest(resourceValue, false, middlecat_url);
      // }

      setLoadingConfig(false);
    },
    [resourceValue, signIn, signInGuest]
  );

  function invalidUrl(url: string) {
    if (resourceFixed) return false;
    return !/^https?:\/\//.test(url);
  }

  useEffect(() => {
    if (resourceFixed && resourceRequired) {
      onSubmit({ preventDefault: () => {} });
    }
  }, [resourceFixed, resourceRequired, onSubmit]);

  if (loadingConfig) return <div className="Loader" />;
  if (resourceFixed && resourceRequired && !error)
    return <div className="Loader" />;

  return (
    <form onSubmit={onSubmit}>
      <h2 className="Title">{signInTitle}</h2>

      {resourceFixed ? null : (
        <input
          type="url"
          id="url"
          name="url"
          placeholder={resourceExample || "https://amcat-server.example"}
          value={resourceValue}
          onChange={(e) => {
            if (error) setError("");
            sessionStorage.setItem("AuthformResource", e.target.value);
            setResourceValue(e.target.value);
          }}
        />
      )}

      <button disabled={invalidUrl(resourceValue)} type="submit">
        {signInButtonLabel || "Connect to server"}
      </button>
      {error && <p>{error}</p>}
    </form>
  );
}

interface SignOutFormProps {
  user: MiddlecatUser;
  resourceFixed?: string;
  signIn: (resource: string, middlecat_url?: string) => Promise<void>;
  signOut: (signOutMiddlecat: boolean) => Promise<void>;
  signOutTitle?: string;
  signOutButtonLabel?: string;
}

function SignOutForm({
  user,
  resourceFixed,
  signIn,
  signOut,
  signOutTitle,
  signOutButtonLabel,
}: SignOutFormProps) {
  if (!user.authenticated) {
    return (
      <>
        <h2 className="Title">{signOutTitle}</h2>

        <div className="NoAuthLabel"></div>
        <div className="SignOut">
          <button onClick={() => signIn(user.resource, user.middlecat)}>
            Sign-in
          </button>
          {resourceFixed ? null : (
            <button onClick={() => signOut(false)}>Change server</button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="Title">{signOutTitle}</h2>

      <div className="User">
        {user?.image ? (
          <img
            className="Image"
            src={user.image}
            referrer-policy="no-referrer"
            alt=""
          />
        ) : null}
        <div>
          {user?.name || user?.email}
          {user?.name && user?.email ? (
            <>
              <br />
              <span style={{ fontSize: "0.8em" }}>{user?.email}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="SignOut">
        <button onClick={() => signOut(false)}>
          {signOutButtonLabel || "Sign-out Server"}
        </button>
        <button onClick={() => signOut(true)}>{"Sign-out MiddleCat"}</button>
      </div>
    </>
  );
}
