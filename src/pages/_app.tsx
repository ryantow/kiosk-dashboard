// src/pages/_app.tsx
import type { AppProps } from "next/app";
import "../styles/globals.css";          // <-- make sure this path exists
import { UserProvider } from '@auth0/nextjs-auth0/client';  // <--this was added for auth0 support
import Layout from "@/components/Layout";

export default function App(
  { Component, pageProps }: AppProps & { pageProps: { user?: any } }
) {
  return (
    <UserProvider user={pageProps.user}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </UserProvider>
  );
}