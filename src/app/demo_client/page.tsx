"use client";

import { useMiddlecat, MiddlecatProvider } from "middlecat-react";
import { useEffect, useState } from "react";
import { FaUser } from "react-icons/fa";

export default function Demo() {
  const [client, setClient] = useState(false);

  useEffect(() => setClient(true), []);

  if (!client) return null;
  return (
    <MiddlecatProvider fixedResource={`api/demo_resource`}>
      <DemoComponent />
    </MiddlecatProvider>
  );
}

function DemoComponent() {
  const { user, signIn, signOut } = useMiddlecat();

  return (
    <div className="Page">
      <style jsx>
        {`
          .Container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 10vh;
          }
          .LoginForm {
            margin: 1rem;
          }
          .User {
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: 800;
            font-size: 1.7rem;
            color: var(--primary);
          }
          .UserName {
            display: flex;
            flex-direction: column;
          }

          .Image {
            height: 60px;
            width: 60px;
            border-radius: 10px;
            margin-right: 1rem;
            font-size: 2.7rem;
            background: var(--secondary);
            fill: white;
            border: 1px solid var(--secondary);
          }

          .MissingImage {
            height: 30px;
            width: 40px;
            margin-right: 1rem;
          }
        `}
      </style>
      <div className="Container" style={{ fontSize: "0.8rem" }}>
        <div className="User">
          {user?.image ? (
            <img className="Image" src={user.image} referrer-policy="no-referrer" alt="Profile picture" />
          ) : (
            <FaUser className="MissingImage" />
          )}
          <div className="UserName">
            {user?.name || user?.email}
            {user?.name ? <span style={{ fontSize: "1.2rem" }}>{user?.email}</span> : null}
          </div>
        </div>
        <div className="LoginForm">
          {!user?.email ? (
            <button onClick={() => signIn()}>Sign-in</button>
          ) : (
            <button onClick={() => signOut(false)}>Sign-out</button>
          )}
        </div>
      </div>
    </div>
  );
}
