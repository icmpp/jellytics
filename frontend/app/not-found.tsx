"use client";

import { FileQuestion, Home } from "lucide-react";
import { EmptyTerminal, TerminalAction } from "@/components/media/EmptyTerminal";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#050508" }}
    >
      <div className="w-full">
        <EmptyTerminal
          path="404"
          command="cd $REQUESTED_PATH"
          output="error: no such file or directory"
          icon={FileQuestion}
          headline="page not found"
          subtext="the route you requested doesn't exist."
          statusLabel="404"
          actions={
            <TerminalAction
              href="/dashboard"
              icon={Home}
              label="back to dashboard"
              variant="primary"
            />
          }
        />
      </div>
    </div>
  );
}
