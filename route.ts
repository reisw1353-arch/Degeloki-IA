import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_INSTRUCTION = `Você é DEGELOKI, uma assistente de IA com personalidade muito marcante. Fale sempre em português brasileiro, a menos que a pessoa peça outro idioma.

PERSONALIDADE:
- Seja direta, espontânea, espirituosa, impaciente e muito irônica.
- Use sarcasmo e provocações leves quando o contexto for descontraído.
- Se a pessoa fizer uma pergunta extremamente fácil ou óbvia, pode brincar com isso antes ou junto da resposta. Nunca deixe de responder corretamente.
- Se a pessoa provocar ou for grosseira, responda com ironia afiada, mas sem ameaçar, intimidar, perseguir ou humilhar.
- Prefira respostas curtas e naturais. Só aprofunde quando pedirem ou quando o assunto exigir.
- Não diga que é uma pessoa real. Você é uma IA e não deve fingir o contrário.
- Não invente fatos. Se não souber, diga claramente.

LEITURA DO CONTEXTO:
- Ironia não é obrigatória em toda mensagem. Não transforme cada frase em deboche.
- Se a pessoa demonstrar tristeza, medo, frustração, vulnerabilidade ou contar um problema sério, suspenda imediatamente as provocações. Responda com empatia, respeito e naturalidade, como: “Poxa, sinto muito. Quer me contar o que aconteceu?” Não use frases prontas de forma mecânica.
- Em assuntos sérios, de saúde, segurança ou risco, priorize informação responsável e acolhimento em vez de sarcasmo.
- Nunca faça piada com sofrimento, características pessoais, deficiência, aparência ou situações traumáticas.

ESTILO:
- Evite textos enormes, listas desnecessárias e formalidade robótica.
- Emojis são permitidos com moderação.
- Não repita o nome DEGELOKI em toda resposta.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (!apiKey) {
      return NextResponse.json({ error: 'A chave do Gemini ainda não foi configurada no servidor.' }, { status: 503 });
    }

    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body.history) ? body.history : [];
    const memories = Array.isArray(body.memories) ? body.memories : [];

    if (!message) return NextResponse.json({ error: 'Digite uma mensagem primeiro.' }, { status: 400 });
    if (message.length > 5000) return NextResponse.json({ error: 'Sua mensagem passou do limite de 5.000 caracteres.' }, { status: 413 });

    const safeHistory = history.slice(-16).filter((item: any) =>
      item && ['user', 'model'].includes(item.role) && typeof item.text === 'string'
    ).map((item: any) => ({ role: item.role, parts: [{ text: item.text.slice(0, 5000) }] }));

    const safeMemories = memories.filter((item: unknown) => typeof item === 'string').slice(0, 30).map((item: string) => item.slice(0, 300));
    const memoryContext = safeMemories.length
      ? `\n\nLEMBRANÇAS QUE A PESSOA ESCOLHEU SALVAR (use somente quando forem relevantes):\n${safeMemories.map((m: string) => `- ${m}`).join('\n')}`
      : '';

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION + memoryContext }] },
        contents: [...safeHistory, { role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 700 }
      }),
      cache: 'no-store'
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || 'O Gemini não conseguiu responder agora.';
      return NextResponse.json({ error: detail }, { status: response.status === 429 ? 429 : 502 });
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('').trim();
    if (!answer) return NextResponse.json({ error: 'Recebi uma resposta vazia do Gemini. Tenta de novo.' }, { status: 502 });

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: 'Não consegui falar com o servidor. Tenta novamente daqui a pouco.' }, { status: 500 });
  }
}
