"use client";

import { Session } from "next-auth";
import { useEffect, useState } from "react";
import CreateApiKey from "./CreateApiKey";
import { ApiKeySession, BrowserSession, SessionData } from "@/types";
import Popup from "./Popup";
import useCsrf from "@/query/useCsrf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading } from "./Loading";
import { ErrorMsg } from "./ErrorMsg";
import { FaClock } from "react-icons/fa";

interface props {
  session: Session | null;
}

async function fetchSessions(): Promise<SessionData> {
  const res = await fetch("/api/sessions");
  if (!res.ok) throw new Error("Could not fetch sessions");
  return res.json();
}

export default function AmcatSessions({ session }: props) {
  const queryClient = useQueryClient();
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
  });
  const { data: csrfToken } = useCsrf();

  async function closeSessions(amcatSessionIds: string[]) {
    let anyChanged = false;
    function killSession(session_id: string) {
      return fetch(`/api/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grant_type: "kill_session", session_id: session_id }),
      });
    }

    for (const session_id of amcatSessionIds) {
      const res = await killSession(session_id);
      if (res.ok) anyChanged = true;
    }

    if (anyChanged) queryClient.invalidateQueries({ queryKey: ["sessions"] });
  }

  if (isLoading) <Loading />;
  if (!session) return null;
  if (!sessionData) return <ErrorMsg>Could not fetch sessions</ErrorMsg>;

  return (
    <div className="SessionData fadeIn">
      <style jsx>{`
        .SessionData {
          display: flex;
          flex-wrap: wrap;
          gap: 2rem;
          color: white;
          padding: 1rem;
          margin-top: 2rem;
        }
        .SessionContainer {
          flex: 1 1 auto;
          width: 50rem;
          max-width: 90vw;
          padding: 1rem 2rem;
          text-align: center;
          border: 1px solid var(--primary);
          border-radius: 1rem;
          box-shadow: 0px 1px 10px 0px var(--primary);
        }
        :global(.AmcatSession) {
          display: flex;
          align-items: center;
          margin: 0.5rem 0;
          border: 1px solid var(--primary);
          padding: 0.3rem 0.6rem;
          border-radius: 0.5rem;
        }
        :global(.AmcatSession .Details) {
          flex: 1 1 auto;
          width: 100%;
          white-space: nowrap;
          text-align: left;
          overflow: ellipsis;
        }
        :global(.AmcatSession .Context) {
          color: var(--primary);
          font-style: italic;
        }
        :global(.AmcatSession .Buttons) {
          display: flex;
          gap: 0.3rem;
        }
        :global(.AmcatSession button) {
          display: flex;
          white-space: nowrap;
          margin: 0;
          font-size: 1rem;
        }
      `}</style>

      <div className="SessionContainer">
        <div className="Header">
          <h2>Browser sessions</h2>
          <h4 className="PrimaryColor">Monitor connections across browsers and devices</h4>
          {sessionData?.browser?.length ? null : <h4>- No active sessions -</h4>}
        </div>
        {sessionData.browser.map((session) => {
          return <BrowserSessionRow key={session.id} session={session} closeSessions={closeSessions} />;
        })}
      </div>
      <div className="SessionContainer">
        <div className="Header">
          <h2>API Keys</h2>
          <h4 className="SecondaryColor">Manage and create API keys</h4>
          {sessionData?.apiKey?.length ? null : <h4>- No active API Keys -</h4>}
        </div>
        <CreateApiKey csrfToken={csrfToken || ""} fetchSessions={fetchSessions} />
        {sessionData.apiKey.map((session) => {
          return <ApiKeySessionRow key={session.id} session={session} closeSessions={closeSessions} />;
        })}
      </div>
    </div>
  );
}

function BrowserSessionRow({
  session,
  closeSessions,
}: {
  session: BrowserSession;
  closeSessions: (ids: string[]) => void;
}) {
  const date = new Date(session.createdAt);

  return (
    <div className={`AmcatSession`}>
      <div className="Details">
        <div className="Context">
          {date.toDateString()} - {session.createdOn}
        </div>
        <div className="Label">{session.label}</div>
      </div>
      <div className="Buttons">
        <button className="PrimaryColor" onClick={() => closeSessions([session.id])}>
          close
        </button>
      </div>
    </div>
  );
}

function calcExpiresIn(expires: Date) {
  const expiresDate = new Date(expires);
  return Number(expiresDate.getTime() - Date.now());
}

function ApiKeySessionRow({
  session,
  closeSessions,
}: {
  session: ApiKeySession;
  closeSessions: (ids: string[]) => void;
}) {
  const [expiresIn, setExpiresIn] = useState<number>(calcExpiresIn(session.expires));
  const date = new Date(session.createdAt);

  const expiresInMinutes = expiresIn / (1000 * 60);
  const expiresInValue =
    expiresInMinutes > 60 * 24 ? minutesToDays(expiresInMinutes) : minutesToTimeFormat(expiresInMinutes);

  useEffect(() => {
    const expiresIn = calcExpiresIn(session.expires);
    const expiresInChanges = expiresIn % (1000 * 60);
    const timer = setTimeout(() => setExpiresIn(expiresIn), expiresInChanges);
    return () => clearTimeout(timer);
  });

  return (
    <div className={`AmcatSession`}>
      <div className="Details">
        <div className="Label">{session.label}</div>
        <div className="Context">
          {date.toDateString()} - {session.createdOn}
        </div>
      </div>
      <div className="Buttons">
        <Popup
          trigger={
            <button style={{ display: "flex", gap: "0.4rem" }}>
              <FaClock />
              <span>{expiresInValue}</span>
            </button>
          }
        >
          <h4>Add a form to change the expiration date</h4>
        </Popup>
        <Popup trigger={<button>delete</button>}>
          <h4>Are you certain?</h4>
          <button onClick={() => closeSessions([session.id])}>
            <span style={{ width: "100%", textAlign: "center" }}>Yes, delete</span>
          </button>
        </Popup>
      </div>
    </div>
  );
}

function minutesToDays(minutes: number) {
  return Math.floor(minutes / 60 / 24);
}

function minutesToTimeFormat(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourPart = h < 10 ? `0${h}` : `${h}`;
  const minutePart = m < 10 ? `0${m}` : `${m}`;
  return `${hourPart}:${minutePart}`;
}
