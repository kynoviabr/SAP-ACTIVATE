import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AIMessage, AIProvider, ProjectContext } from '@/types'

export function useAI(options: { provider: AIProvider; model: string; projectContext?: ProjectContext }) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalTokens, setTotalTokens] = useState(0)

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: AIMessage = { role: 'user', content }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('ai-proxy', {
        body: {
          provider: options.provider,
          model: options.model,
          messages: nextMessages,
          projectContext: options.projectContext,
          maxTokens: 1000,
          temperature: 0.3,
        },
      })
      if (invokeError) throw invokeError
      const assistantMessage: AIMessage = { role: 'assistant', content: data.content }
      setMessages((current) => [...current, assistantMessage])
      setTotalTokens((current) => current + Number(data.tokensUsed ?? 0))
      return data.content as string
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao chamar IA'
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [messages, options.model, options.projectContext, options.provider])

  return {
    messages,
    isLoading,
    error,
    totalTokens,
    sendMessage,
    clearMessages: () => {
      setMessages([])
      setError(null)
      setTotalTokens(0)
    },
  }
}
