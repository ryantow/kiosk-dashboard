// src/pages/_app.tsx
import type { AppProps } from "next/app";
import "../styles/globals.css";
import { UserProvider } from "@auth0/nextjs-auth0"; // <- no /client
import Layout from "@/components/Layout";

type Auth0User = {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  [key: string]: unknown;
};

export default function App(
  { Component, pageProps }: AppProps & { pageProps: { user?: UserProfile } }
) {
  return (
    <UserProvider user={pageProps.user}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </UserProvider>
  );
}