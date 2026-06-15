import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "#050508" }}
    >
      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      <p className="font-mono text-xs text-violet-300/55">
        <span className="select-none text-violet-400/45">$ </span>
        loading
        <span className="cursor-blink ml-px text-violet-400/80">_</span>
      </p>
    </div>
  );
}
