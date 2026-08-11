import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <p className="mt-3 text-muted-foreground">This page could not be found.</p>
        <Link
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
          href="/"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
