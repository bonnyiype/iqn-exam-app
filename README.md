# IQN Practice Exam Builder v2.0

A modern, interactive web application for creating and practicing mock exams. Built with React, TypeScript, and Tailwind CSS, supporting up to 150+ questions with a beautiful, responsive interface.

![IQN Exam Builder](https://img.shields.io/badge/version-2.0-blue.svg)
![React](https://img.shields.io/badge/React-18.0-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8.svg)

## 🚀 Features

### Core Functionality
- **📝 Mock Test Parser**: Robust parser supporting single/multi-select questions with rationales
- **⏱️ Timed Exam Mode**: Real-time countdown with pause/resume functionality
- **📊 Instant Grading**: Automatic scoring with pass/fail determination
- **📖 Detailed Review**: Comprehensive answer explanations with rationales
- **💾 Data Export**: Export results to CSV or save exam as JSON
- **🎲 Question Shuffling**: Randomize questions and answer choices
- **🏷️ Question Flagging**: Mark questions for review during the exam
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile

### New in v2.0
- **🎨 Modern UI**: Beautiful gradient backgrounds, animations, and glass-morphism effects
- **🌓 Dark Mode**: Full dark mode support with smooth transitions
- **📈 Performance**: Optimized for handling 150+ questions efficiently
- **🏷️ Categories**: Automatic category detection and performance tracking
- **⌨️ Keyboard Shortcuts**: Navigate questions and select answers with keyboard
- **💾 Progress Saving**: Auto-save exam progress to localStorage
- **📊 Category Analytics**: Performance breakdown by question categories
- **🎯 Advanced Settings**: Customizable timer warnings, navigation options, and more

## 🛠️ Installation

### Prerequisites
- Node.js 16+ and npm/yarn installed
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "IQN EXAM"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

### Production Build

```bash
npm run build
npm run preview
```

## 📋 Usage Guide

### 1. Creating an Exam

1. **Paste or Upload**: Copy your mock test into the text area or upload a .txt file
2. **Format Requirements**:
   ```
   Exam Title Here

   1. Question text goes here?
   A) First choice
   B) Second choice
   C) Third choice
   D) Fourth choice

   2. Another question (Select All That Apply)?
   A) Option one
   B) Option two
   C) Option three
   D) Option four

   Answer Key & Rationale

   1. Answer: B. Explanation for why B is correct.
   2. Answer: A, C. Explanation for multiple correct answers.
   ```

3. **Configure Settings**:
   - Time limit (5-360 minutes)
   - Pass mark percentage
   - Question/choice shuffling
   - Advanced options (navigation, flagging, auto-save)

4. **Start Exam**: Click "Start Exam" to begin

### 2. Taking the Exam

- **Navigation**: Use arrow keys or click Previous/Next buttons
- **Answer Selection**: Click choices or use keyboard (A, B, C, D, E)
- **Flag Questions**: Press 'F' or click Flag button to mark for review
- **Pause/Resume**: Press spacebar or click pause button
- **Submit**: Press Ctrl+Enter or click Submit button

### 3. Reviewing Results

- **Score Summary**: View pass/fail status and percentage
- **Category Breakdown**: See performance by topic
- **Detailed Review**: Expand questions to see correct answers and explanations
- **Export Options**: Download CSV results or save exam JSON
- **Retake**: Practice again with the same questions

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous/Next question |
| `A`-`E` | Select answer choice |
| `F` | Flag/unflag question |
| `Space` | Pause/resume exam |
| `Ctrl+Enter` | Submit exam |
| `T` | Toggle timer display |

## 🏗️ Project Structure

```
IQN EXAM/
├── src/
│   ├── components/      # React components
│   │   ├── Builder/     # Exam builder interface
│   │   ├── Exam/        # Exam taking interface
│   │   ├── Review/      # Results review interface
│   │   └── ui/          # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── store/           # Zustand state management
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Helper functions
│   └── styles/          # Global styles
├── public/              # Static assets
└── package.json         # Dependencies
```

## 🎨 Customization

### Styling
- Edit `src/styles/globals.css` for global styles
- Modify Tailwind config in `tailwind.config.js`
- Component-specific styles in respective component files

### Adding Features
1. Create new components in `src/components/`
2. Add state management in `src/store/`
3. Define types in `src/types/`
4. Implement utilities in `src/utils/`

## 🐛 Troubleshooting

### Common Issues

1. **Parser Errors**
   - Ensure "Answer Key & Rationale" header is present
   - Check question numbering (1., 2., etc.)
   - Verify answer choices format (A), B), etc.)

2. **Performance Issues**
   - Clear browser cache
   - Disable browser extensions
   - Use production build for large exams

3. **Dark Mode Flicker**
   - System preference conflicts
   - Clear localStorage theme setting

## 📄 License

This project is licensed under the ISC License.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the usage guide above

---

Built with ❤️ for better exam preparation
