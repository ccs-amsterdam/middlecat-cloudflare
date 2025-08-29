"use client";

import { useSearchParams } from "next/navigation";

export default function EmailSignin() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const email = searchParams.get("email") || "";

  return (
    <main>
      <style jsx>
        {`
          main {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2rem;
            padding: 2rem;
            margin-top: 10vh;
          }
          form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            width: 100%;
            max-width: 600px;
            color: white;
          }
          button {
            padding: 1rem;
            font-size: 1.5rem;
            font-weight: 500;
          }
        `}
      </style>

      <div>
        <form action="/api/auth/callback/email" method="get">
          <h1>Email authentication confirmed</h1>
          {/* remove `type` and `value` if you want the user to type this manually */}
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input type="hidden" name="email" value={email} />
          <button type="submit" className="w-full">
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
