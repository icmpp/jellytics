"use client";

import { HelpCircle, Server, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SettingsCardHeader,
  FieldLabel,
  SettingsDivider,
  INPUT_CLASS,
  TerminalButton,
} from "./SettingsPrimitives";

export type ServerStatus = "idle" | "checking" | "valid" | "invalid";

interface Props {
  serverURL: string;
  onURLChange: (url: string) => void;
  serverStatus: ServerStatus;
  testUsername: string;
  setTestUsername: (u: string) => void;
  testPassword: string;
  setTestPassword: (p: string) => void;
  loading: boolean;
  testing: boolean;
  error: string;
  serverSettingsSuccess: string;
  testResult: { success: boolean; message: string } | null;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  onSave: (e: React.FormEvent) => void;
  onTest: (e: React.FormEvent) => void;
}

function getStatusIcon(status: ServerStatus) {
  switch (status) {
    case "checking":
      return <Loader2 className="h-4 w-4 animate-spin text-white/40" />;
    case "valid":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "invalid":
      return <XCircle className="h-4 w-4 text-amber-400" />;
    default:
      return <Server className="h-4 w-4 text-white/40" />;
  }
}

function getStatusText(status: ServerStatus) {
  switch (status) {
    case "checking":
      return "pinging server...";
    case "valid":
      return "server reachable";
    case "invalid":
      return "no response — check url";
    default:
      return "";
  }
}

export function JellyfinServerCard({
  serverURL,
  onURLChange,
  serverStatus,
  testUsername,
  setTestUsername,
  testPassword,
  setTestPassword,
  loading,
  testing,
  error,
  serverSettingsSuccess,
  testResult,
  showHelp,
  setShowHelp,
  onSave,
  onTest,
}: Props) {
  return (
    <Card>
      <SettingsCardHeader
        icon={<Server className="h-5 w-5" />}
        title="jellyfin_server"
        description="Configure your server address and verify credentials before saving"
      />
      <CardContent className="space-y-6">
        {/* Server address */}
        <form id="server-url-form" onSubmit={onSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <FieldLabel>server_address</FieldLabel>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-xs transition-colors ${
                showHelp
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-transparent text-white/40 hover:bg-[#0d0d1a] hover:text-white/70"
              }`}
              aria-label="Toggle help"
              aria-expanded={showHelp}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              --help
            </button>
          </div>

          {showHelp && (
            <div className="space-y-2.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3.5">
              <p className="font-mono text-xs text-white/60">
                <span className="select-none text-violet-400/45">{"# "}</span>
                enter the full URL including http:// or https://
              </p>
              <div className="flex flex-wrap gap-2">
                <code className="rounded-sm border border-[#16162a] bg-[#06060d] px-2.5 py-1 font-mono text-xs text-violet-300/80">
                  https://jellyfin.example.com
                </code>
                <code className="rounded-sm border border-[#16162a] bg-[#06060d] px-2.5 py-1 font-mono text-xs text-violet-300/80">
                  http://192.168.1.100:8096
                </code>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {getStatusIcon(serverStatus)}
              </div>
              <Input
                id="server_url"
                type="url"
                placeholder="https://jellyfin.example.com"
                value={serverURL}
                onChange={(e) => onURLChange(e.target.value)}
                required
                className={`pl-11 ${INPUT_CLASS} ${
                  serverStatus === "valid"
                    ? "border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                    : serverStatus === "invalid"
                      ? "border-amber-500/30 focus:border-amber-500/50 focus:ring-amber-500/20"
                      : ""
                }`}
                aria-describedby="server_url_status"
              />
            </div>
            {serverStatus !== "idle" && (
              <p
                id="server_url_status"
                className={`font-mono text-xs transition-colors ${
                  serverStatus === "valid"
                    ? "text-emerald-400"
                    : serverStatus === "invalid"
                      ? "text-amber-400"
                      : "text-white/40"
                }`}
              >
                {getStatusText(serverStatus)}
              </p>
            )}
          </div>
        </form>

        <SettingsDivider label="verify_credentials" />

        {/* Credentials + actions */}
        <form onSubmit={onTest} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel>username</FieldLabel>
              <Input
                id="test_username"
                type="text"
                placeholder="Your Jellyfin username"
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>password</FieldLabel>
              <Input
                id="test_password"
                type="password"
                placeholder="Your Jellyfin password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-3 rounded-sm border p-3.5 font-mono text-sm ${
                testResult.success
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
              role="alert"
              aria-live="polite"
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <p>{testResult.message}</p>
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-3 rounded-sm border border-red-500/20 bg-red-500/10 p-3.5 font-mono text-sm text-red-400"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {serverSettingsSuccess && (
            <div
              className="flex items-start gap-3 rounded-sm border border-emerald-500/20 bg-emerald-500/10 p-3.5 font-mono text-sm text-emerald-400"
              role="alert"
              aria-live="polite"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{serverSettingsSuccess}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <TerminalButton type="submit" variant="idle" disabled={testing || !serverURL}>
              {testing ? (
                <>
                  <Loader2 className="animate-spin" />
                  testing...
                </>
              ) : (
                "test_connection"
              )}
            </TerminalButton>
            <TerminalButton
              type="submit"
              form="server-url-form"
              className="flex-1"
              disabled={loading || serverStatus === "checking"}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  saving...
                </>
              ) : (
                "save_settings"
              )}
            </TerminalButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
