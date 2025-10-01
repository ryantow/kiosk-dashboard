// File: src/components/AuthButtons.tsx
import { useUser } from "@auth0/nextjs-auth0";

// File: src/pages/_app.tsx
import { UserProvider } from '@auth0/nextjs-auth0';

type Auth0User = { name?: string | null; email?: string | null; picture?: string | null; [key: string]: unknown };

export default function App({ Component, pageProps }: AppProps & { pageProps: { user?: Auth0User } }) {

// File: src/pages/index.tsx
import { useUser } from "@auth0/nextjs-auth0";