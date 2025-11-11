import { useEffect, useRef, useState } from 'react'
import './Blackboard.css'

interface BlackboardProps {
  content: string
  onClear: () => void
}

function Blackboard({ content, onClear }: BlackboardProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (content !== displayedContent) {
      setIsWriting(true)
      let currentIndex = displayedContent.length

      // If content is shorter (cleared), reset immediately
      if (content.length < displayedContent.length) {
        setDisplayedContent(content)
        setIsWriting(false)
        return
      }

      // Animate the writing
      const interval = setInterval(() => {
        if (currentIndex < content.length) {
          setDisplayedContent(content.substring(0, currentIndex + 1))
          currentIndex++
        } else {
          setIsWriting(false)
          clearInterval(interval)
        }
      }, 20) // Speed of writing animation

      return () => clearInterval(interval)
    }
  }, [content, displayedContent])

  useEffect(() => {
    // Auto-scroll to bottom as content is written
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [displayedContent])

  return (
    <div className="blackboard">
      <div className="blackboard-frame">
        <div className="blackboard-header">
          <div className="blackboard-title">📝 Classroom Blackboard</div>
          <button className="eraser-button" onClick={onClear} title="Clear blackboard">
            🧽 Clear
          </button>
        </div>

        <div className="blackboard-content" ref={contentRef}>
          <pre className="chalk-text">
            {displayedContent}
            {isWriting && <span className="cursor">_</span>}
          </pre>
        </div>

        <div className="chalk-tray">
          <div className="chalk chalk-white"></div>
          <div className="chalk chalk-yellow"></div>
          <div className="chalk chalk-green"></div>
          <div className="chalk chalk-blue"></div>
        </div>
      </div>
    </div>
  )
}

export default Blackboard
