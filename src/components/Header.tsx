"use client";

export default function Header() {
  return (
    <header className="Header">
      <style jsx>{`
        .Header {
          padding: 1.5rem 0.5rem;
          text-align: center;
          vertical-align: middle;
          position: relative;
          color: white;
          background: var(--header);
          box-shadow: 0px 0px 10px 0px var(--secondary);
          border-bottom: 1px solid var(--primary);
        }
        h2 {
          font-size: clamp(2rem, 17vw, 5rem);
          line-height: 5rem;
          font-weight: bold;
          margin-bottom: 0;
          margin-top: 0.5rem;
        }
        h4 {
          font-size: 1.5rem;
          margin-top: 0;
          margin-bottom: 0.5rem;
          color: var(--primary);
        }
      `}</style>
      <div>
        <h2>MiddleCat</h2>
        <h4>cat-in-the-middle authentication</h4>
      </div>
    </header>
  );
}
