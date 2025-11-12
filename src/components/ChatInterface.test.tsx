import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatInterface from './ChatInterface'
import type { Message } from '../App'

function makeMessages(initial?: Partial<Message>[]): Message[] {
  return (initial || []).map((m, i) => ({
    id: String(i + 1),
    role: m?.role ?? 'assistant',
    content: m?.content ?? 'Hello',
    timestamp: m?.timestamp ?? new Date(),
  }))
}

describe('ChatInterface', () => {
  it('calls onSendMessage and clears input', async () => {
    const user = userEvent.setup()
    const onSendMessage = vi.fn()

    render(<ChatInterface messages={makeMessages()} onSendMessage={onSendMessage} />)

    const input = screen.getByPlaceholderText('Ask a question about the Quran...') as HTMLInputElement
    await user.type(input, 'What is Ramadan?')
    await user.keyboard('{Enter}')

    expect(onSendMessage).toHaveBeenCalledWith('What is Ramadan?')
    expect(input.value).toBe('')
  })
})
