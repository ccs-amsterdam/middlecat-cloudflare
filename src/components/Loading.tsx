export function Loading({ msg }: { msg?: string }) {
  return (
    <div className="Container">
      <style jsx>{`
        .Container {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          margin-top: 5rem;
        }
        h2 {
          margin-top: 1rem;
          font-size: 1.25rem;
          font-weight: bold;
          color: white;
        }

        .spike-loader {
          --color: var(--primary);
          position: relative;
          width: 85px;
          height: 50px;
          background-repeat: no-repeat;
          background-image: linear-gradient(var(--color) 50px, transparent 0),
            linear-gradient(var(--color) 50px, transparent 0),
            linear-gradient(var(--color) 50px, transparent 0),
            linear-gradient(var(--color) 50px, transparent 0),
            linear-gradient(var(--color) 50px, transparent 0),
            linear-gradient(var(--color) 50px, transparent 0);
          background-position: 0px center, 15px center, 30px center, 45px center,
            60px center, 75px center, 90px center;
          animation: rikSpikeRoll 0.65s linear infinite alternate;
        }

        @keyframes rikSpikeRoll {
          0% {
            background-size: 10px 3px;
          }
          16% {
            background-size: 10px 50px, 10px 3px, 10px 3px, 10px 3px, 10px 3px,
              10px 3px;
          }
          33% {
            background-size: 10px 30px, 10px 50px, 10px 3px, 10px 3px, 10px 3px,
              10px 3px;
          }
          50% {
            background-size: 10px 10px, 10px 30px, 10px 50px, 10px 3px, 10px 3px,
              10px 3px;
          }
          66% {
            background-size: 10px 3px, 10px 10px, 10px 30px, 10px 50px, 10px 3px,
              10px 3px;
          }
          83% {
            background-size: 10px 3px, 10px 3px, 10px 10px, 10px 30px, 10px 50px,
              10px 3px;
          }
          100% {
            background-size: 10px 3px, 10px 3px, 10px 3px, 10px 10px, 10px 30px,
              10px 50px;
          }
        }
      `}</style>
      <span className="spike-loader"></span>
      <h2>{msg || ""}</h2>
    </div>
  );
}
