# AI Quran Teacher - Virtual Classroom

An interactive web application that simulates a classroom experience where you can chat with an AI teacher and watch as it writes lessons on a virtual blackboard.

## Features

- **Interactive Chat Interface**: Ask questions and receive responses from the AI teacher
- **Virtual Blackboard**: Watch as the teacher writes answers on an animated blackboard with chalk-like effects
- **Real-time Writing Animation**: Text appears letter-by-letter on the blackboard, simulating natural writing
- **Classroom Theme**: Beautiful UI design that recreates the feel of a traditional classroom
- **Pre-loaded Knowledge**: Built-in responses about the Quran, Islamic teachings, and the Five Pillars of Islam
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technologies Used

- **React 18** - Modern UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **CSS3** - Custom styling with animations

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AIQuranTeacher
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:5173
```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build locally

## Usage

1. **Ask Questions**: Type your questions in the chat interface at the right side of the screen
2. **View Responses**: The AI teacher will respond in the chat
3. **Watch the Blackboard**: The teacher's response will be written on the blackboard with a typewriter effect
4. **Clear the Board**: Click the "Clear" button to erase the blackboard content

### Sample Questions

Try asking about:
- "What are the Five Pillars of Islam?"
- "Tell me about Prophet Muhammad"
- "How many Surahs are in the Quran?"
- "What is Ramadan?"
- "Tell me about prayer in Islam"

## Project Structure

```
AIQuranTeacher/
├── src/
│   ├── components/
│   │   ├── Blackboard.tsx        # Blackboard component with animations
│   │   ├── Blackboard.css        # Blackboard styling
│   │   ├── ChatInterface.tsx     # Chat UI component
│   │   └── ChatInterface.css     # Chat styling
│   ├── App.tsx                   # Main application component
│   ├── App.css                   # Main app styling
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles
├── index.html                    # HTML template
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite configuration
└── README.md                     # This file
```

## Customization

### Adding More Questions and Answers

Edit the `generateAIResponse` function in `src/App.tsx` to add more topics and responses:

```typescript
function generateAIResponse(userInput: string): string {
  const input = userInput.toLowerCase()

  if (input.includes('your-keyword')) {
    return `Your custom response here`
  }

  // ... more conditions
}
```

### Styling the Blackboard

Modify `src/components/Blackboard.css` to change:
- Blackboard color
- Chalk color
- Text size and font
- Animation speed

### Changing Chat Appearance

Edit `src/components/ChatInterface.css` to customize:
- Message bubble colors
- Chat header style
- Input field appearance

## Future Enhancements

Potential features to add:
- [ ] Integration with actual AI API (OpenAI, Claude, etc.)
- [ ] Audio narration for responses
- [ ] Arabic text support with proper RTL display
- [ ] Multiple blackboard pages
- [ ] Save/export conversation history
- [ ] Drawing capabilities on the blackboard
- [ ] Multiple language support
- [ ] User authentication
- [ ] Progress tracking

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Inspired by traditional classroom teaching methods
- Built with modern web technologies for an engaging learning experience
