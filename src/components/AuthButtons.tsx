import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";

export default function AuthButtons() {
  const { user, isLoading } = useUser();
  if (isLoading) return null;

  return user ? (
    <div className="flex items-center gap-3">
      <span>{user.name ?? user.email}</span>
      <Link href="/api/auth/logout">Logout</Link>
    </div>
  ) : (
    <Link href="/api/auth/login">Login</Link>
  );
}