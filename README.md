# 🏥 RehabOS

> AI-powered physiotherapy and fitness rehabilitation platform delivering real-time posture correction, intelligent exercise recommendations, and performance analytics directly from your browser.

RehabOS leverages computer vision and AI-driven logic to help users **track, correct, and improve exercise form** — enabling safer, smarter, and more effective rehabilitation and workouts.

---

# 📑 Table of Contents

* [Introduction](#-introduction)
* [Key Features](#-key-features)
* [System Architecture](#-system-architecture)
* [Installation & Setup](#-installation--setup)
* [Run Locally](#-run-locally)
* [Build for Production](#-build-for-production)
* [Run Using Docker](#-run-using-docker)
* [Project Structure](#-project-structure)
* [AI Modules](#-ai-modules)
* [Deployment Options](#-deployment-options)
* [Scalability](#-scalability)
* [Business Model](#-business-model)
* [Operating Environment](#-operating-environment)
* [Future Enhancements](#-future-enhancements)
* [Testing](#-testing)
* [Contribution](#-contribution)
* [License](#-license)

---

# 📖 Introduction

RehabOS is a modular AI-driven rehabilitation system built using modern frontend technologies and real-time pose detection. It combines:

* Computer Vision
* Finite State Machine (FSM) logic
* Intelligent chatbot recommendations
* AI performance analytics

All processing is performed client-side — **no backend required**.

---

# 🚀 Key Features

## 🧠 1. Real-Time AI Exercise Feedback

* MediaPipe Pose Detection
* FSM-based repetition logic
* Automatic rep counting
* Live posture correction
* Audio & visual cues
* Form accuracy tracking

---

## 🤖 2. AI Physiotherapy Chatbot

* Accepts injury or muscle group descriptions
* Maps inputs to supported exercises
* Displays:

  * Exercise name
  * Description
  * Reference/tutorial video
* Graceful fallback handling for unsupported inputs

---

## 📊 3. AI Analysis Dashboard

* 📈 Line charts for performance trends
* 🥧 Pie charts for form accuracy
* 📊 Bar graphs for exercise comparison
* 📌 KPI summary cards
* Built using Recharts

Designed for future integration with cloud-based session data.

---

## 📚 4. Exercise Catalog

* 10+ physiotherapy & strength exercises
* Guided instructions
* Tutorial videos
* Camera placement recommendations
* Personalized difficulty settings

---

## 👤 5. User Experience Features

* Pinned exercises
* Custom workout programs
* Session summaries
* Personalized exercise parameters

---

# 🏗️ System Architecture

RehabOS follows a modular frontend architecture:

| Layer          | Technology           |
| -------------- | -------------------- |
| UI Framework   | React.js             |
| Design System  | Material UI          |
| Pose Detection | MediaPipe            |
| Logic Engine   | FSM-based evaluation |
| Visualization  | Recharts             |
| Processing     | 100% Client-side     |

This architecture ensures scalability and low infrastructure cost.

---

# 💻 Installation & Setup

## 📌 Prerequisites

* Node.js (v16+ recommended)
* npm
* Webcam-enabled device
* Docker (optional)

---

# ▶️ Run Locally

Inside the `app` folder:

```bash
cd app
npm install
npm start
```

Open in browser:

```
http://localhost:3000
```

---

# 🏗️ Build for Production

```bash
npm run build
```

---

# 🐳 Run Using Docker

## 1️⃣ Build Docker Image

```bash
cd app
docker build -t rehabos .
```

## 2️⃣ Run Container

```bash
docker run -p 3000:3000 rehabos
```

Access:

```
http://localhost:3000
```

---

# 📂 Project Structure

```
RehabOS/
├── app/
│   ├── src/
│   │   ├── components/
│   │   ├── utils/
│   │   ├── exercises/
│   │   └── pages/
│   ├── Dockerfile
│   └── package.json
├── README.md
└── LICENSE
```

---

# 🧠 AI Modules

## 🔹 Chatbot Logic

Uses structured mappings:

* `injuryExerciseMap`
* `muscleExerciseMap`

Matches user input against available exercises and renders instructional content dynamically.

---

## 🔹 AI Analysis Module

Provides:

* Rep statistics
* Form accuracy visualization
* Performance graphs
* Progress tracking trends

Architecture is extendable to support cloud session storage.

---

# 🌍 Deployment Options

RehabOS supports deployment via:

* Vercel
* Netlify
* Render (Docker)
* AWS EC2
* Firebase Hosting

---

# 📈 Scalability

RehabOS is designed for scale:

* Modular exercise framework
* Client-side AI processing
* Extendable chatbot logic
* Analytics-ready architecture
* Cloud deployment compatibility

---

# 💼 Business Model

RehabOS follows a **Freemium SaaS model**:

| Tier          | Features                              |
| ------------- | ------------------------------------- |
| Free          | Core AI posture correction            |
| Premium       | Advanced analytics & personalization  |
| Institutional | Clinic & corporate wellness licensing |

---

# ⚠️ Operating Environment

For optimal AI accuracy:

* Use a well-lit environment
* Ensure full-body visibility
* Avoid cluttered backgrounds
* Follow recommended camera positioning

---

# 🔮 Future Enhancements

* Personalized AI recommendations
* Therapist dashboard
* Multi-user detection
* React Native mobile app
* Wearable device integration
* Cloud session storage
* Backend analytics layer

---

# 🧪 Testing

Includes:

* Chatbot input validation
* FSM state transition validation
* Negative input handling
* UI responsiveness testing

---

# 🙌 Contribution

Contributions, feature suggestions, and feedback are welcome.

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

---

# 📜 License

This project is licensed under the terms specified in the `LICENSE` file.

---

# 🎯 Final Statement

RehabOS bridges the gap between physiotherapy expertise and accessible home-based rehabilitation using AI, computer vision, and intelligent analytics.
