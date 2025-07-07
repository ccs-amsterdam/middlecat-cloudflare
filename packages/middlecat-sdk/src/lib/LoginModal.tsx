import styled from "styled-components";
import { Middlecat } from "./types";
import AuthForm from "./AuthForm";
import { useRef } from "react";

interface Props {
  middlecat: Middlecat;
  fixedResource?: string;
  resourceRequired?: boolean;
  title?: string;
  primary?: string;
  secondary?: string;
  fontSize?: string;
}

function LoginModal({
  middlecat,
  fixedResource,
  resourceRequired,
  title,
  primary,
  secondary,
  fontSize,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!middlecat?.loading && middlecat?.user) return null;

  return (
    <LoginModalDiv fontSize={fontSize} primary={primary}>
      {middlecat.loading ? (
        "Loading..."
      ) : (
        <div ref={ref} className="AuthForm">
          <AuthForm
            resourceFixed={fixedResource}
            resourceRequired={resourceRequired}
            signInTitle={title}
            primary={primary}
            secondary={secondary}
            fontSize={"1em"}
          />
        </div>
      )}
    </LoginModalDiv>
  );
}

const LoginModalDiv = styled.div<{ fontSize?: string; primary?: string }>`
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  position: fixed;
  display: flex;
  justify-content: center;
  backdrop-filter: blur(5px);
  background-color: #fff8;
  z-index: 1000;

  .AuthForm {
    margin: auto 1rem;
    margin-top: min(10em, 10vh);
    padding: 2rem;
    width: 40rem;
    max-width: 90vw;
    background-color: #fff3;
    border-radius: 10px;
    font-size: ${(p) => p.fontSize || "1.4em"};
    border: 1px solid ${(p) => p.primary || "var(--primary)"};

    h2 {
      text-align: center;
      font-size: 1.8em;
    }
  }
`;

export default LoginModal;
