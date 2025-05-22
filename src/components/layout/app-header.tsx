import { LogoIcon } from "@/components/icons/logo-icon";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link
          href="/"
          className="mr-6 flex items-center space-x-2"
          suppressHydrationWarning={true}
        >
          <LogoIcon className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block text-lg">HiveLens</span>
        </Link>
      </div>
    </header>
  );
}
