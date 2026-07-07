"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface TestResult { ok: boolean; status: number; response: string; }

// Bouton de test VisioFormation (Route A) : envoie un payload JSON d'exemple vers l'URL de Joseph,
// uniquement si les deux mots de passe sont identiques. Affiche la réponse de VF + le payload envoyé.
export function VisioformationTestView({ defaultUrl = "" }: { defaultUrl?: string }) {
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [payload, setPayload] = useState<string | null>(null);

  const passwordsMatch = password1.length > 0 && password1 === password2;
  const canSend = targetUrl.trim().length > 0 && passwordsMatch && !sending;

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    setPayload(null);
    try {
      const res = await fetch("/api/visioformation/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: targetUrl.trim(), password1, password2 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'envoi.");
        return;
      }
      setResult({ ok: data.ok, status: data.status, response: data.response ?? "" });
      setPayload(JSON.stringify(data.sentPayload, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Envoyer un webhook de test à VisioFormation</CardTitle>
          <CardDescription>
            Envoie un payload JSON d&apos;exemple (format ADF) vers l&apos;URL fournie par Joseph.
            L&apos;envoi n&apos;a lieu que si les deux mots de passe sont identiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetUrl">URL de réception (Joseph)</Label>
            <Input
              id="targetUrl"
              type="url"
              placeholder="https://preprod.visioformation.fr/webhook/…"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p1">Mot de passe</Label>
              <Input id="p1" type="password" value={password1} onChange={(e) => setPassword1(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2">Confirmer le mot de passe</Label>
              <Input id="p2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
            </div>
          </div>
          {password2.length > 0 && !passwordsMatch && (
            <p className="text-sm text-red-600">Les deux mots de passe ne sont pas identiques.</p>
          )}
          <Button onClick={send} disabled={!canSend}>
            {sending ? "Envoi en cours…" : "Envoyer le test"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className={result.ok ? "text-green-700" : "text-red-700"}>
              Réponse de VisioFormation — HTTP {result.status} {result.ok ? "✓" : "✗"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Réponse reçue</Label>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{result.response || "(vide)"}</pre>
            </div>
            {payload && (
              <div>
                <Label>Payload envoyé</Label>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{payload}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
