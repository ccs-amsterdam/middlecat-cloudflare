"use client";

export default function verifyRequest() {
  return (
    <div className="Page">
      <style jsx>{`
        .Page {
          margin: 2rem auto;
          padding: 1rem 1rem;
          width: 100%;
          position: relative;
          display: flex;
          flex-direction: column;

          color: white;
          text-align: center;
        }
        i {
          color: var(--primary);
        }
      `}</style>
      <div className="Container Narrow">
        <h3>Please check your email</h3>

        <p>
          We have sent you a link to sign-in and continue your session. <br />
        </p>
        <i>You can close this window</i>
      </div>
    </div>
  );
}
