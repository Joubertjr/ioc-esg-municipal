import { useState, type FormEvent } from "react";
import { useAgentQuery } from "../../hooks/useAgentQuery";
import { useAuthContext } from "../../contexts/AuthContext";

interface AgentQueryPanelProps {
  ibgeCode: string;
}

const SUGGESTIONS = [
  "Qual o score do ODS 3?",
  "Qual o score global do município?",
  "Como estão os ODS 3, 4 e 6?",
];

export function AgentQueryPanel({ ibgeCode }: AgentQueryPanelProps) {
  const { currentUser } = useAuthContext();
  const [question, setQuestion] = useState("");
  const { mutate, data, isPending, isError, error, reset } = useAgentQuery();

  const role = currentUser?.role;
  const canAsk = role === "admin" || role === "prefeito" || role === "secretario";

  if (!canAsk) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || !role) return;

    const payload: Parameters<typeof mutate>[0] = {
      municipalityId: ibgeCode,
      question: trimmed,
      role: role as "admin" | "prefeito" | "secretario",
      locale: "pt-BR",
    };
    if (/ods\s*3.*4.*6|3,\s*4.*6/i.test(trimmed)) {
      payload.odsFilter = [3, 4, 6];
    }
    mutate(payload);
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Pergunte aos dados (MDO)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Respostas determinísticas a partir dos scores ODS — sem alucinação de LLM.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (data || isError) reset();
          }}
          rows={2}
          placeholder="Ex.: Qual o score do ODS 6?"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={isPending || question.trim().length < 3}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Consultando…" : "Perguntar"}
        </button>
      </form>

      {isError && (
        <p className="text-sm text-destructive">{error?.message ?? "Erro na consulta."}</p>
      )}

      {data && (
        <div className="border border-border rounded-lg p-4 space-y-2">
          <p className="text-sm text-foreground leading-relaxed">{data.answer}</p>
          <p className="text-xs text-muted-foreground">
            Confiança {Math.round(data.confidence * 100)}% · modo {data.mode}
          </p>
        </div>
      )}
    </div>
  );
}
