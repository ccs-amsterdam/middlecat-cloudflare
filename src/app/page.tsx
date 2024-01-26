"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import AmcatSessions from "../components/AmcatSessions";
import { useState } from "react";
import { Loading } from "@/components/Loading";

export default function Home() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  if (status === "loading") return <Loading />;

  return (
    <>
      <style jsx>{`
        .Login {
          margin: auto;
          width: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
          max-width: 400px;
        }
        .Login button {
          padding: 0.5rem 1rem;
          border-radius: 5px;
          border: none;
          background: var(--primary);
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
        }
        .Login button:hover {
          background: var(--secondary);
        }
        .Loading {
          cursor: progress;
        }
      `}</style>
      <div>
        <div className="Login">
          <div className="">
            <h2 className="text-center">Sessions and API keys</h2>
            <p>
              On this page you can see and disconnect your active AmCAT sessions
              and manage your API keys.
            </p>

            <div className="Login">
              {session?.user ? (
                <>
                  <button
                    className={loading ? "Loading" : ""}
                    onClick={() => {
                      setLoading(true);
                      signOut().catch(() => setLoading(false));
                    }}
                  >
                    sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={loading ? "Loading" : ""}
                    onClick={() => {
                      setLoading(true);
                      signIn().catch(() => setLoading(false));
                    }}
                  >
                    sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="">
        <AmcatSessions session={session} />
      </div>
    </>
  );
}
