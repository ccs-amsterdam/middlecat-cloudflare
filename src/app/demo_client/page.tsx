import Login from "./components/Login";
import { getSession } from "./components/lib";

export default async function Home() {
  const session = await getSession();
  return (
    <main style={{ color: "white", padding: "2rem", display: "flex" }}>
      <div style={{ margin: "auto", textAlign: "center" }}>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Sign in to your account to continue.
        </p>
        <div>
          <pre>{JSON.stringify(session, null, 2)}</pre>
        </div>
        <Login />
      </div>
    </main>
  );
}
