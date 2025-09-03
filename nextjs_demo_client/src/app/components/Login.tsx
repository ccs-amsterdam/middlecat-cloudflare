"use client";
import useSession from "./useSession";

const Login = () => {
  const { session, loading } = useSession();
  if (loading) {
    return <div>Loading...</div>;
  }
  if (session?.isLoggedIn) {
    return (
      <button
        onClick={() => {
          window.location.href = "auth/logout";
        }}
      >
        Logout
      </button>
    );
  }
  return (
    <button
      onClick={() => {
        window.location.href = "auth/login";
      }}
    >
      Login
    </button>
  );
};

export default Login;
