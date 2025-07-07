interface AuthFormProps {
    primary?: string;
    secondary?: string;
    fontSize?: string;
    resourceExample?: string;
    resourceSuggestion?: string;
    resourceFixed?: string;
    resourceRequired?: boolean;
    signInTitle?: string;
    signOutTitle?: string;
    signInButtonLabel?: string;
    signOutButtonLabel?: string;
}
export default function AuthForm({ primary, secondary, fontSize, resourceExample, resourceSuggestion, resourceFixed, resourceRequired, signInTitle, signOutTitle, signInButtonLabel, signOutButtonLabel, }: AuthFormProps): import("react/jsx-runtime").JSX.Element;
export {};
