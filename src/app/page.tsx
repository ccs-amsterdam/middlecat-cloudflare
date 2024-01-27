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
    <div className="Login fadeIn">
      <style jsx>{`
        .Login {
          margin: 2rem auto;
          width: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
          max-width: 400px;
          color: white;
          text-align: center;
        }

        .Loading {
          cursor: progress;
        }
        .AmcatSessions {
          display: flex;
          justify-content: center;
        }
      `}</style>
      <div>
        <div className="">
          <h2 className="text-center">Sessions and API keys</h2>
          <p>
            On this page you can see and manage your active MiddleCat sessions
            and API keys.
          </p>

          <div className="SignIn">
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
      <div className="AmcatSessions">
        <AmcatSessions session={session} />
      </div>
    </div>
  );
}
