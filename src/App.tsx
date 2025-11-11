import { useState } from 'react'
import ChatInterface from './components/ChatInterface'
import Blackboard from './components/Blackboard'
import './App.css'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to the AI Quran Teacher Classroom! Ask me anything about the Quran, and I\'ll write the answers on the blackboard.',
      timestamp: new Date()
    }
  ])
  const [blackboardContent, setBlackboardContent] = useState<string>('')

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])

    // Simulate AI response (in a real app, this would call an API)
    setTimeout(() => {
      const aiResponse = generateAIResponse(content)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      // Update blackboard with the AI's response
      setBlackboardContent(prev => {
        const newContent = prev ? prev + '\n\n' + aiResponse : aiResponse
        return newContent
      })
    }, 1000)
  }

  const handleClearBlackboard = () => {
    setBlackboardContent('')
  }

  return (
    <div className="classroom">
      <header className="classroom-header">
        <h1>🕌 AI Quran Teacher - Virtual Classroom</h1>
      </header>

      <div className="classroom-content">
        <div className="blackboard-section">
          <Blackboard content={blackboardContent} onClear={handleClearBlackboard} />
        </div>

        <div className="chat-section">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  )
}

// Simple AI response generator (placeholder for actual AI integration)
function generateAIResponse(userInput: string): string {
  const input = userInput.toLowerCase()

  if (input.includes('surah') || input.includes('chapter')) {
    return `📖 The Quran consists of 114 Surahs (chapters).\n\nEach Surah has a unique name and contains Ayahs (verses). The longest Surah is Al-Baqarah (The Cow) with 286 verses, and the shortest are Al-Kawthar, Al-Asr, and Al-Nasr with just 3-4 verses each.`
  }

  if (input.includes('pillar') || input.includes('pillars')) {
    return `🕋 The Five Pillars of Islam:\n\n1. Shahada - Declaration of Faith\n2. Salah - Prayer (5 times daily)\n3. Zakat - Charitable giving\n4. Sawm - Fasting during Ramadan\n5. Hajj - Pilgrimage to Mecca\n\nThese form the foundation of Muslim life.`
  }

  if (input.includes('prophet') || input.includes('muhammad')) {
    return `☪️ Prophet Muhammad (PBUH):\n\n- Born in Mecca around 570 CE\n- Received first revelation at age 40\n- The final prophet in Islam\n- Known as "Al-Amin" (The Trustworthy)\n- His life is an example for Muslims\n\nThe Quran was revealed to him over 23 years.`
  }

  if (input.includes('prayer') || input.includes('salah')) {
    return `🤲 Salah (Prayer):\n\nMuslims pray 5 times daily:\n- Fajr (Dawn)\n- Dhuhr (Noon)\n- Asr (Afternoon)\n- Maghrib (Sunset)\n- Isha (Night)\n\nPrayer includes standing, bowing, and prostration while reciting verses from the Quran.`
  }

  if (input.includes('ramadan') || input.includes('fasting')) {
    return `🌙 Ramadan:\n\nThe 9th month of Islamic calendar\n- Muslims fast from dawn to sunset\n- No food, drink, or smoking\n- Focus on prayer and reflection\n- Ends with Eid al-Fitr celebration\n\nFasting teaches self-discipline and empathy.`
  }

  if (input.includes('hello') || input.includes('hi') || input.includes('salam')) {
    return `السلام عليكم (As-salamu alaykum)\nPeace be upon you!\n\nWelcome to our virtual classroom. I'm here to teach you about the Quran and Islamic teachings. What would you like to learn about today?`
  }

  return `Thank you for your question about "${userInput}".\n\nI'm here to help you learn about the Quran and Islamic teachings. You can ask me about:\n\n- Surahs and verses\n- The Five Pillars of Islam\n- Prophet Muhammad (PBUH)\n- Prayer and worship\n- Islamic history and teachings\n\nWhat would you like to explore?`
}

export default App
