"use client";

import useCsrf from "@/query/useCsrf";
import useProviders from "@/query/useProviders";
import { Provider } from "next-auth/providers";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaBackward, FaEnvelope, FaGithub, FaGoogle, FaUndo } from "react-icons/fa";

const logos: any = {
  Email: <FaEnvelope />,
  GitHub: <FaGithub />,
  Google: <FaGoogle />,
};

export default function SignIn() {
  return (
    <div className="SignInForm">
      <style jsx>
        {`
          .SignInForm {
            width: 100%;
            margin: 0 auto;
            max-width: 415px;
            color: white;
            margin-top: 5vh;
            display: flex;
            flex-direction: column;
          }
        `}
      </style>
      <div style={{ textAlign: "center" }}>
        <Providers />
      </div>
    </div>
  );
}

function Providers() {
  const { data: providers } = useProviders();
  const { data: csrfToken } = useCsrf();
  const [emailForm, setEmailForm] = useState(false);

  const [loading, setLoading] = useState("");

  if (!csrfToken || !providers) return null;

  if (emailForm) {
    return <EmailLogin loading={loading} setLoading={setLoading} setEmailForm={setEmailForm} />;
  }

  return (
    <div>
      <style jsx>
        {`
          button {
            position: relative;
            text-align: center;
            display: flex;
            gap: 1rem;
            padding: 1rem;
            font-size: 1.3rem;
            font-weight: 500;
          }
          button span {
            flex-grow: 1;
          }

          .Logo {
            position: absolute;
            left: 0.8rem;
          }
        `}
      </style>
      <h2>Sign in with</h2>
      {Object.values(providers).map((provider) => {
        return (
          <div className="Provider" key={provider.name}>
            <button
              className={loading === provider.name ? "Loading" : ""}
              onClick={() => {
                if (provider.name === "Email") {
                  setEmailForm(true);
                  return;
                }
                setLoading(provider.name);
                signIn(provider.id).finally(() => setLoading(""));
              }}
            >
              <span>{provider.name}</span>
              <div className="Logo">{logos[provider.name]}</div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function EmailLogin({
  loading,
  setLoading,
  setEmailForm,
}: {
  loading: string;
  setLoading: (loading: string) => void;
  setEmailForm: (emailForm: boolean) => void;
}) {
  return (
    <div>
      <h2>Email login</h2>
      <form
        key="emailform"
        className="EmailForm"
        onSubmit={(e) => {
          e.preventDefault();
          const email = e.currentTarget.email.value;
          setLoading("Email");
          signIn("email", { email }).finally(() => setLoading(""));
        }}
      >
        <style jsx>{`
          .EmailForm {
            display: flex;
            flex-direction: column;
            margin: 1rem;
          }

          .EmailInput {
            display: flex;
            align-items: center;
            position: relative;
          }

          .EmailInput input {
            margin: 0rem 0rem;
            width: 100%;
            border-radius: 10px;
            border: none;
            height: 40px;
            padding: 0.5rem 1rem;
            font-size: inherit;
          }
          .Back {
            background: var(--background);
            color: white;
          }
        `}</style>

        <div className="EmailInput">
          <input type="email" id="email" name="email" placeholder="example@email.com" />
        </div>
        <button className={loading ? "Loading" : ""} type="submit">
          <div className="Logo">
            <FaEnvelope />
          </div>
          Send magic link
        </button>
        <div>
          <button
            className="Back"
            onClick={(e) => {
              e.preventDefault();
              setEmailForm(false);
            }}
          >
            Go back
          </button>
        </div>
      </form>
    </div>
  );
}
