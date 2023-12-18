"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import AmcatSessions from "../components/AmcatSessions";
import { useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  if (status === "loading") return null;

  return (
    <>
      <div>
        <div className="m-auto w-full relative flex flex-col max-w-[400px]">
          <div className="prose">
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
