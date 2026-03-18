import type { PropsWithChildren } from "react";
import AuthButtons from "./AuthButtons";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full border-b px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">Kiosk Dashboard</div>
        <AuthButtons />
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}