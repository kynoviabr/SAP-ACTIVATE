// supabase/functions/ai-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── System prompt builder ─────────────────────────────────────────────────
function buildSystemPrompt(ctx?: Record<string, unknown>): string {
  const base = `Você é o Assistente IA do portal de gestão de projetos SAP Activate.
Responda sempre em português brasileiro.
Seja objetivo e use bullet points quando listar itens.
Formate datas como DD/MM/AAAA.
Use markdown simples (negrito, listas) para melhorar a legibilidade.`

  if (!ctx) return base

  return `${base}

CONTEXTO DO PROJETO ATUAL:
- Projeto: ${ctx.projectName ?? '—'}
- Cliente: ${ctx.client ?? '—'}
- Fase atual: ${ctx.currentPhase ?? '—'}
- Status: ${ctx.status ?? '—'}
- SPI: ${ctx.spi ?? '—'}
- Progresso: ${ctx.progress ?? 0}%
- Go-Live: ${ctx.goLiveDate ?? '—'}
- Issues abertas: ${ctx.openIssues ?? 0}
- Riscos críticos: ${ctx.criticalRisks ?? 0}
- Módulos SAP: ${Array.isArray(ctx.modules) ? ctx.modules.join(', ') : '—'}

Use esses dados para contextualizar suas respostas sobre o projeto.`
}

// ── Provider callers ──────────────────────────────────────────────────────
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: unknown[],
  systemPrompt: string,
  maxTokens: number,
  temperature: number
) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'OpenAI error')
  return {
    content:    data.choices[0].message.content as string,
    tokensUsed: data.usage?.total_tokens ?? 0,
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: unknown[],
  systemPrompt: string,
  maxTokens: number,
  temperature: number
) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error')
  return {
    content:    data.content[0].text as string,
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: unknown[],
  systemPrompt: string,
  maxTokens: number,
  temperature: number
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const contents = (messages as { role: string; content: string }[]).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  return {
    content:    data.candidates[0].content.parts[0].text as string,
    tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Init Supabase with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 3. Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Get user's tenant
    const { data: userProfile } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Parse request body
    const body = await req.json()
    const {
      provider   = 'openai',
      model      = 'gpt-4-turbo',
      messages   = [],
      projectContext,
      maxTokens  = 1000,
      temperature = 0.3,
    } = body

    // 6. Get API key (from env or tenant config)
    let apiKey: string | null = null

    // Try env first (platform-level keys)
    if (provider === 'openai')    apiKey = Deno.env.get('OPENAI_API_KEY')    ?? null
    if (provider === 'anthropic') apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? null
    if (provider === 'gemini')    apiKey = Deno.env.get('GEMINI_API_KEY')    ?? null

    // Fallback: tenant's own key
    if (!apiKey) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('ai_api_key_enc')
        .eq('id', userProfile.tenant_id)
        .single()
      apiKey = tenant?.ai_api_key_enc ?? null
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `No API key configured for provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Build system prompt
    const systemPrompt = buildSystemPrompt(projectContext)

    // 8. Call AI provider
    let result: { content: string; tokensUsed: number }

    switch (provider) {
      case 'openai':
        result = await callOpenAI(apiKey, model, messages, systemPrompt, maxTokens, temperature)
        break
      case 'anthropic':
        result = await callAnthropic(apiKey, model, messages, systemPrompt, maxTokens, temperature)
        break
      case 'gemini':
        result = await callGemini(apiKey, model, messages, systemPrompt, maxTokens, temperature)
        break
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // 9. Return response
    return new Response(
      JSON.stringify({ ...result, provider, model }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
