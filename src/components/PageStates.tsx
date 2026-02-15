import Link from "next/link";
import { Loader2 } from "lucide-react";

/** Full-screen centered loading spinner with optional message. */
export function PageLoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
        <p className="text-foreground-secondary">{message}</p>
      </div>
    </div>
  );
}

/** Full-screen centered error state with back-home link. */
export function PageErrorState({ message = "Something went wrong" }: { message?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-accent text-xl mb-4">{message}</p>
        <Link
          href="/"
          className="text-foreground-secondary hover:text-foreground transition-colors"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
