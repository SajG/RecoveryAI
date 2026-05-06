"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Salesperson = { id?: string; name: string; tallyGroup: string; phone: string; email: string; active: boolean };

type SettingsPayload = {
  companyName: string;
  ownerEmail: string;
  timezone: string;
  currency: string;
  priorityCriticalOutstanding: number;
  priorityCriticalOverdueDays: number;
  priorityHighOutstanding: number;
  priorityHighOverdueDays: number;
  priorityMediumOutstanding: number;
  priorityMediumOverdueDays: number;
  bridgeEndpointUrl: string;
  bridgeSecret: string | null;
  tallyUrl: string;
  syncSchedule: string;
  notificationDigest: string;
  whatsappAlertsNumber: string | null;
  alertOnCriticalParty: boolean;
  alertOnSyncFail: boolean;
  alertOnTargetMiss: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [showBridgeSecret, setShowBridgeSecret] = useState(false);
  const [bridgeTestMessage, setBridgeTestMessage] = useState<string | null>(null);
  const [bridgeTestOk, setBridgeTestOk] = useState<boolean | null>(null);
  const [runningBridgeTest, setRunningBridgeTest] = useState(false);

  async function loadData() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { settings: SettingsPayload; salespeople: Salesperson[] };
    setSettings(data.settings);
    setSalespeople(data.salespeople);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveSettings() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings, salespeople }),
    });
    await loadData();
  }

  async function testBridgeConnection() {
    setBridgeTestMessage(null);
    setBridgeTestOk(null);
    setRunningBridgeTest(true);
    try {
      const response = await fetch("/api/settings/bridge-test", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        checks?: Record<string, boolean>;
        tallyStatusCode?: number | null;
        tallyBodyPreview?: string;
        tallyError?: string | null;
      };

      const checkFailures = Object.entries(data.checks ?? {})
        .filter(([, passed]) => !passed)
        .map(([name]) => name);

      if (response.ok && data.ok) {
        setBridgeTestOk(true);
        setBridgeTestMessage("Bridge connection successful. Tally and bridge secrets look good.");
        return;
      }

      const failureText = checkFailures.length > 0 ? `Failed checks: ${checkFailures.join(", ")}` : null;
      const tallyText =
        data.tallyError ??
        (data.tallyStatusCode ? `Tally status: ${data.tallyStatusCode}` : null) ??
        (data.tallyBodyPreview ? `Tally response: ${data.tallyBodyPreview}` : null);
      setBridgeTestOk(false);
      setBridgeTestMessage(
        [data.message ?? "Bridge connection test failed", failureText, tallyText].filter(Boolean).join(" | ")
      );
    } catch (error) {
      setBridgeTestOk(false);
      setBridgeTestMessage(error instanceof Error ? error.message : "Unable to test bridge connection");
    } finally {
      setRunningBridgeTest(false);
    }
  }

  if (!settings) return <div>Loading settings...</div>;

  function Toggle({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  }) {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
    );
  }

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-6">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="salespeople">Salespeople</TabsTrigger>
        <TabsTrigger value="priority">Priority Rules</TabsTrigger>
        <TabsTrigger value="bridge">Tally Bridge</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card><CardContent className="grid gap-3 pt-4 md:grid-cols-2">
          <div><p className="text-xs text-slate-500">Company (read-only)</p><Input value={settings.companyName} disabled /></div>
          <div><p className="text-xs text-slate-500">Owner email</p><Input value={settings.ownerEmail} onChange={(e) => setSettings({ ...settings, ownerEmail: e.target.value })} /></div>
          <div><p className="text-xs text-slate-500">Timezone</p><Input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></div>
          <div><p className="text-xs text-slate-500">Currency</p><Input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} /></div>
          <Button onClick={saveSettings}>Save</Button>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="salespeople">
        <Card><CardContent className="space-y-2 pt-4">
          {salespeople.map((sp, idx) => (
            <div key={`${sp.id ?? "new"}_${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <Input value={sp.name} onChange={(e) => setSalespeople((rows) => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} placeholder="Name" />
              <Input value={sp.tallyGroup} onChange={(e) => setSalespeople((rows) => rows.map((r, i) => i === idx ? { ...r, tallyGroup: e.target.value } : r))} placeholder="Tally Group" />
              <Input value={sp.phone} onChange={(e) => setSalespeople((rows) => rows.map((r, i) => i === idx ? { ...r, phone: e.target.value } : r))} placeholder="Phone" />
              <Input value={sp.email} onChange={(e) => setSalespeople((rows) => rows.map((r, i) => i === idx ? { ...r, email: e.target.value } : r))} placeholder="Email" />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sp.active}
                  onChange={(event) =>
                    setSalespeople((rows) => rows.map((r, i) => (i === idx ? { ...r, active: event.target.checked } : r)))
                  }
                />
                <span className="text-sm">Active</span>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setSalespeople((rows) => [...rows, { name: "", tallyGroup: "", phone: "", email: "", active: true }])
              }
            >
              + Add new salesperson row
            </Button>
          </div>
          <div>
            <Button onClick={saveSettings} className="bg-slate-900 text-white hover:bg-slate-800">
              Save Numbers
            </Button>
          </div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="priority">
        <Card><CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <p className="text-sm md:col-span-2">Critical: Outstanding ≥ ₹___ OR overdue ≥ ___ days</p>
            <Input type="number" value={settings.priorityCriticalOutstanding} onChange={(e) => setSettings({ ...settings, priorityCriticalOutstanding: Number(e.target.value || 0) })} />
            <Input type="number" value={settings.priorityCriticalOverdueDays} onChange={(e) => setSettings({ ...settings, priorityCriticalOverdueDays: Number(e.target.value || 0) })} />
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <p className="text-sm md:col-span-2">High: Outstanding ≥ ₹___ OR overdue ≥ ___ days</p>
            <Input type="number" value={settings.priorityHighOutstanding} onChange={(e) => setSettings({ ...settings, priorityHighOutstanding: Number(e.target.value || 0) })} />
            <Input type="number" value={settings.priorityHighOverdueDays} onChange={(e) => setSettings({ ...settings, priorityHighOverdueDays: Number(e.target.value || 0) })} />
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <p className="text-sm md:col-span-2">Medium: Outstanding ≥ ₹___ OR overdue ≥ ___ days</p>
            <Input type="number" value={settings.priorityMediumOutstanding} onChange={(e) => setSettings({ ...settings, priorityMediumOutstanding: Number(e.target.value || 0) })} />
            <Input type="number" value={settings.priorityMediumOverdueDays} onChange={(e) => setSettings({ ...settings, priorityMediumOverdueDays: Number(e.target.value || 0) })} />
          </div>
          <Button onClick={saveSettings}>Save</Button>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="bridge">
        <Card><CardContent className="space-y-3 pt-4">
          <div><p className="text-xs text-slate-500">Bridge endpoint URL</p><Input value={settings.bridgeEndpointUrl} onChange={(e) => setSettings({ ...settings, bridgeEndpointUrl: e.target.value })} /></div>
          <div>
            <p className="text-xs text-slate-500">Bridge secret</p>
            <div className="flex gap-2">
              <Input type={showBridgeSecret ? "text" : "password"} value={settings.bridgeSecret ?? ""} onChange={(e) => setSettings({ ...settings, bridgeSecret: e.target.value })} />
              <Button variant="outline" size="icon-sm" onClick={() => setShowBridgeSecret((v) => !v)}>{showBridgeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              <Button variant="outline" onClick={() => setSettings({ ...settings, bridgeSecret: Math.random().toString(36).slice(2, 14) })}><RotateCcw className="mr-1 h-4 w-4" />Regenerate</Button>
            </div>
          </div>
          <div><p className="text-xs text-slate-500">Tally URL</p><Input value={settings.tallyUrl} onChange={(e) => setSettings({ ...settings, tallyUrl: e.target.value })} /></div>
          <div>
            <p className="text-xs text-slate-500">Sync schedule</p>
            <Select value={settings.syncSchedule} onValueChange={(value) => setSettings({ ...settings, syncSchedule: value ?? settings.syncSchedule })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily_8am">Daily 8 AM</SelectItem>
                <SelectItem value="twice_daily">Twice daily</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={testBridgeConnection} disabled={runningBridgeTest}>
              {runningBridgeTest ? "Testing..." : "Test connection"}
            </Button>
            <Button onClick={saveSettings}>Save</Button>
          </div>
          {bridgeTestMessage ? (
            <p className={`text-sm ${bridgeTestOk ? "text-emerald-700" : "text-red-700"}`}>{bridgeTestMessage}</p>
          ) : null}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="notifications">
        <Card><CardContent className="space-y-3 pt-4">
          <div>
            <p className="text-xs text-slate-500">Email digest</p>
            <Select value={settings.notificationDigest} onValueChange={(value) => setSettings({ ...settings, notificationDigest: value ?? settings.notificationDigest })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><p className="text-xs text-slate-500">WhatsApp number (future)</p><Input value={settings.whatsappAlertsNumber ?? ""} onChange={(e) => setSettings({ ...settings, whatsappAlertsNumber: e.target.value })} /></div>
          <div className="space-y-2">
            <Toggle checked={settings.alertOnCriticalParty} onChange={(checked) => setSettings({ ...settings, alertOnCriticalParty: checked })} label="When critical party added" />
            <Toggle checked={settings.alertOnSyncFail} onChange={(checked) => setSettings({ ...settings, alertOnSyncFail: checked })} label="When sync fails" />
            <Toggle checked={settings.alertOnTargetMiss} onChange={(checked) => setSettings({ ...settings, alertOnTargetMiss: checked })} label="When recovery target missed" />
          </div>
          <Button onClick={saveSettings}>Save</Button>
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}
