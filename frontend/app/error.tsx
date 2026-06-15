"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { EmptyTerminal, TerminalAction } from "@/components/media/EmptyTerminal";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#050508" }}
    >
      <div className="w-full">
        <EmptyTerminal
          path="error"
          command="run ./app"
          output={`error: ${error.message || "something went wrong"}`}
          icon={AlertTriangle}
          headline="something broke"
          subtext="an unexpected error occurred. you can retry or head home."
          statusLabel="error"
          actions={
            <>
              <TerminalAction onClick={reset} icon={RotateCcw} label="retry" variant="primary" />
              <TerminalAction href="/dashboard" icon={Home} label="dashboard" />
            </>
          }
        />
      </div>
    </div>
  );
}
