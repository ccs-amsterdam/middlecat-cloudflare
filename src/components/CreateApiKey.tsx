"use client";

import { useState } from "react";
import { FaClipboard, FaWindowClose } from "react-icons/fa";
import copyToClipboard from "../functions/copyToClipboard";
import getResourceConfig from "../functions/getResourceConfig";
import { useQueryClient } from "@tanstack/react-query";

export default function CreateApiKey({ csrfToken, fetchSessions }: { csrfToken: string; fetchSessions: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string>();

  function createdToken(token: string) {
    setToken(token);
    fetchSessions();
  }

  function finish() {
    setToken(undefined);
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  }

  return (
    <div>
      <button onClick={() => setOpen(true)}>Create new key</button>
      <Modal visible={open}>
        {token ? (
          <ShowAPIKey token={token} finish={finish} />
        ) : (
          <CreateKeyForm csrfToken={csrfToken} createdToken={createdToken} finish={finish} />
        )}
      </Modal>
    </div>
  );
}

function Modal({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <div>
      <style jsx>{`
        .modal {
          display: "flex";
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #222d;
          z-index: 100;
          justify-content: center;
          align-items: center;
        }
        .modal-content {
          border: 1px solid var(--primary);
          box-shadow: 0px 1px 10px 0px var(--secondary);
          background: var(--secondary);
          border-radius: 5px;
          padding: 1rem;
          max-width: 95vw;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          animation: slideIn 0.5s;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-30%) scale(0.1);
          }
          to {
            opacity: 1;
            transform: translateY(0%) scale(1);
          }
        }
      `}</style>
      <div className="modal fadeIn" style={{ display: visible ? "flex" : "none" }}>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}

function ShowAPIKey({ token, finish }: { token: string; finish: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="token">
      <style jsx>{`
        .token {
          text-align: center;
          border-radius: 5px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px dotted var(--secondary);
        }
        h4 {
          margin: 0rem;
        }
        p {
          color: white;
        }
        pre {
          color: var(--primary);

          padding: 1rem;
          overflow: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
          word-break: break-all;
          text-align: justify;
          margin: 0;
          font-size: 0.879rem;
          max-width: 20rem;
        }
        .copy {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem;
          cursor: pointer;
        }
        button {
          margin-top: 2rem;
          border: 1px solid var(--primary);
        }
        a {
          color: var(--primary);
        }
      `}</style>
      <h4>Your new API Key</h4>

      <p>You will only see this once, so copy it!</p>
      <pre>{token}</pre>
      <div
        className="copy"
        onClick={() => {
          copyToClipboard(token);
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        }}
      >
        <FaClipboard size="2rem" color="var(--primary)" />
        <div>{copied ? "copied!" : "click to copy"}</div>
      </div>
      <button onClick={() => finish()}>Close window </button>
    </div>
  );
}

function CreateKeyForm({
  csrfToken,
  createdToken,
  finish,
}: {
  csrfToken: string;
  createdToken: (token: string) => void;
  finish: () => void;
}) {
  const [error, setError] = useState<string>();
  const today = new Date(Date.now());
  const defaultDate = new Date(Date.now());
  defaultDate.setFullYear(defaultDate.getFullYear() + 1);

  async function onSubmit(e: any) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const expires = new Date(String(formData.get("expires_date") || ""));
    const resource = formData.get("resource") as string;

    // MAYBE JUST MAKE THIS A WARNING?
    // NOT THROWING AN ERROR IS USEFULL FOR SERVERS THAT MIDDLECAT CANNOT CONNECT TO,
    // FOR EXAMPLE WHEN THE SERVER IS BEHIND A FIREWALL
    //
    // try {
    //   const resourceConfig = await getResourceConfig(resource);
    //   const thisMiddlecat = window.location.origin;
    //   if (resourceConfig.middlecat_url !== thisMiddlecat) {
    //     setError(`Server users a different MiddleCat: ${resourceConfig.middlecat_url}`);
    //     return;
    //   }
    // } catch (e) {
    //   setError(`Could not get server config`);
    //   return;
    // }

    const body = {
      csrfToken,
      resource,
      label: formData.get("label"),
      clientId: "API_KEY",
      refreshRotate: !!formData.get("rotating"),
      type: "apiKey",
      oauth: false,
      expiresIn: Math.floor((expires.getTime() - Date.now()) / 1000),
    };

    const res = await fetch(`/api/newAmcatSession`, {
      body: JSON.stringify(body),
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      setError(undefined);
      const data: { refresh_token: string } = await res.json();
      createdToken(data?.refresh_token as string);
    } else {
      setError("Could not create API key :(");
    }
  }

  return (
    <>
      <style jsx>{`
        form {
          width: 300px;
          max-width: 90vw;
        }
        .field {
          margin-bottom: 1.5rem;
          text-align: center;
          width: 100%;
          max-width: 25rem;
        }
        label {
          margin: 0.5rem;
          min-width: 0px;
        }
        input {
          margin-top: 0.5rem;
          font-size: 1rem;
          min-width: 0px;
          width: 100%;
          padding: 0.5rem;
          border-radius: 5px;
          border: 1px solid white;
          text-align: center;
        }
        input:valid {
          background: var(--primary);
        }
        input:invalid {
          background: #ccc;
        }
        .checkbox {
          display: flex;
          justify-content: center;
        }
        .checkbox input {
          height: 1.8rem;
          width: 1.8rem;
        }
        .error {
          margin-top: 1rem;
          width: 100%;
          background: #813030;
          color: white;
          border-radius: 5px;
          padding: 0rem 1rem;
          text-align: center;
        }

        button {
          margin-top: 1rem;
        }
        .cancel {
          width: 100%;
          text-align: right;
        }
        .cancelIcon {
          cursor: pointer;
        }
        #submit:hover {
          background-color: #2225;
        }
      `}</style>
      <div className="cancel">
        <span onClick={() => finish()} className="cancelIcon">
          <FaWindowClose size="2rem" />
        </span>
      </div>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="resource">Server</label>
          <input
            type="url"
            id="resource"
            name="resource"
            placeholder="https://amcat-server.com"
            required
            onChange={() => setError(undefined)}
          />
        </div>
        <div className="field">
          <label htmlFor="label">Label</label>
          <input
            type="text"
            id="label"
            name="label"
            title="Provide a label between 5 and 50 characters long"
            pattern=".{5,50}"
            placeholder="pick a label"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="expires">Expires</label>
          <input
            type="datetime-local"
            id="expires"
            name="expires_date"
            required
            defaultValue={defaultDate.toISOString().slice(0, 16)}
            min={today.toISOString().slice(0, 16)}
          />
        </div>

        <div className="field checkbox">
          <label htmlFor="rotate">Rotate refresh tokens</label>
          <input type="checkbox" id="rotate" name="rotating" />
        </div>

        <button id="submit">create API key</button>
        <div className="error">{error}</div>
      </form>
    </>
  );
}
