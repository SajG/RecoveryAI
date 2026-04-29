"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ActionModalProps = {
  partyId: string;
  defaultCreatedBy: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledActionLabel?: string;
  onSuccess: () => Promise<void> | void;
};

const ACTION_TYPES = ["Call", "Visit", "WhatsApp", "Email", "LegalNotice", "StopSupply"] as const;
const ACTION_OUTCOMES = ["PromiseToPay", "NoResponse", "Disputed", "PartialPayment", "Recovered"] as const;
type ActionType = (typeof ACTION_TYPES)[number];
type ActionOutcome = (typeof ACTION_OUTCOMES)[number];

export function ActionModal({
  partyId,
  defaultCreatedBy,
  open,
  onOpenChange,
  prefilledActionLabel,
  onSuccess,
}: ActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<ActionType>("Call");
  const [outcome, setOutcome] = useState<ActionOutcome>("PromiseToPay");
  const [notes, setNotes] = useState(prefilledActionLabel ?? "");
  const [createdBy, setCreatedBy] = useState(defaultCreatedBy);
  const [amountCommitted, setAmountCommitted] = useState("");
  const [amountRecovered, setAmountRecovered] = useState("");
  const [commitmentDate, setCommitmentDate] = useState("");

  const canSubmit = useMemo(() => notes.trim().length > 0 && createdBy.trim().length > 0 && !loading, [notes, createdBy, loading]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/parties/${partyId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          outcome,
          notes: notes.trim(),
          createdBy: createdBy.trim(),
          amountCommitted,
          amountRecovered,
          commitmentDate: commitmentDate || null,
        }),
      });
      if (!response.ok) return;
      await onSuccess();
      onOpenChange(false);
      setNotes(prefilledActionLabel ?? "");
      setAmountCommitted("");
      setAmountRecovered("");
      setCommitmentDate("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log New Action</DialogTitle>
          <DialogDescription>Capture the latest follow-up so the team has full context.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Action Type</Label>
            <Select value={actionType} onValueChange={(value) => setActionType(value as ActionType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={(value) => setOutcome(value as ActionOutcome)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OUTCOMES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="What happened in the call/visit?"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Amount Committed (INR)</Label>
              <Input value={amountCommitted} onChange={(event) => setAmountCommitted(event.target.value)} placeholder="25000" />
            </div>
            <div className="grid gap-2">
              <Label>Amount Recovered (INR)</Label>
              <Input value={amountRecovered} onChange={(event) => setAmountRecovered(event.target.value)} placeholder="15000" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Commitment Date</Label>
              <Input type="date" value={commitmentDate} onChange={(event) => setCommitmentDate(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Created By</Label>
              <Input value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? "Saving..." : "Log Action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
