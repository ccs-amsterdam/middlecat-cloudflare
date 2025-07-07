import { Middlecat } from "./types";
interface Props {
    middlecat: Middlecat;
    fixedResource?: string;
    resourceRequired?: boolean;
    title?: string;
    primary?: string;
    secondary?: string;
    fontSize?: string;
}
declare function LoginModal({ middlecat, fixedResource, resourceRequired, title, primary, secondary, fontSize, }: Props): import("react/jsx-runtime").JSX.Element | null;
export default LoginModal;
