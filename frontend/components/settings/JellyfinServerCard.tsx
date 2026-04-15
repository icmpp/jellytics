"use client";

import { HelpCircle, Server, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      return "Checking server...";
    case "valid":
      return "Server found!";
    case "invalid":
      return "Could not reach server";
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
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 bg-purple-500" />
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Server className="h-5 w-5 text-purple-400" />
          Jellyfin Server
        </CardTitle>
        <CardDescription>
          Configure your server address and verify credentials before saving
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Server address */}
        <form id="server-url-form" onSubmit={onSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
              Server Address
            </span>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
              aria-label="Toggle help"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Help
            </button>
          </div>

          {showHelp && (
            <div className="p-3.5 rounded-xl bg-white/3 border border-white/8 space-y-2.5">
              <p className="text-xs font-medium text-white/60">
                Enter the full URL including http:// or https://
              </p>
              <div className="flex flex-wrap gap-2">
                <code className="text-xs bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg text-purple-300">
                  https://jellyfin.example.com
                </code>
                <code className="text-xs bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg text-purple-300">
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
                className={`pl-11 transition-colors ${
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
                className={`text-xs font-medium transition-colors ${
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

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/6" />
          <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">
            Verify Credentials
          </span>
          <div className="flex-1 h-px bg-white/6" />
        </div>

        {/* Credentials + actions */}
        <form onSubmit={onTest} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                Username
              </span>
              <Input
                id="test_username"
                type="text"
                placeholder="Your Jellyfin username"
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                Password
              </span>
              <Input
                id="test_password"
                type="password"
                placeholder="Your Jellyfin password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
              role="alert"
              aria-live="polite"
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <p className="font-medium">{testResult.message}</p>
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {serverSettingsSuccess && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
              role="alert"
              aria-live="polite"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{serverSettingsSuccess}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button type="submit" variant="outline" disabled={testing || !serverURL}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              type="submit"
              form="server-url-form"
              className="flex-1"
              disabled={loading || serverStatus === "checking"}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
