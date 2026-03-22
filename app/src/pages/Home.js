import React from "react";
import { useNavigate } from "react-router-dom";
import { disclaimerText } from "../assets/content";
import logo from "../assets/logos/logoNoName.png";
import bridgeImg from "../assets/exercise-cards/bridge.png";
import squatImg from "../assets/exercise-cards/squat.png";
import plankImg from "../assets/exercise-cards/plank.png";
import pushUpImg from "../assets/exercise-cards/pushUp.png";
import deadBugImg from "../assets/exercise-cards/deadBug.png";
import shoulderRollsImg from "../assets/exercise-cards/shoulderRolls.png";
import "./Home.css";

const FEATURES = [
  {
    icon: "🤖",
    title: "AI Pose Detection",
    desc: "Real-time body tracking via your webcam using MediaPipe. Get instant feedback on your exercise form — no wearables needed.",
  },
  {
    icon: "🩺",
    title: "Rehab Plans",
    desc: "Describe your injury or upload medical documents. Our AI generates a personalized weekly exercise plan with sets, reps, and schedule.",
  },
  {
    icon: "📊",
    title: "AI Analysis Dashboard",
    desc: "Track every session with interactive charts — reps, duration, trends, exercise distribution, and a radar performance view.",
  },
  {
    icon: "🏆",
    title: "Recovery Score",
    desc: "A gamified 0–100 score based on sessions, consistency, coverage, and improvement. Maintain your streak and watch your score climb.",
  },
  {
    icon: "💬",
    title: "Physio Chatbot",
    desc: "Gemini 2.5 Pro powered assistant that answers your physio questions and recommends exercises with embedded instruction videos.",
  },
  {
    icon: "📄",
    title: "PDF Reports & Email",
    desc: "Download a comprehensive rehabilitation report as PDF or have it emailed directly to your inbox via SMTP.",
  },
  {
    icon: "👨‍⚕️",
    title: "Therapist Portal",
    desc: "Physiotherapists can review, modify, and approve patient rehab plans. Monitor patient progress with full AI analytics.",
  },
  {
    icon: "📹",
    title: "Live Video Sessions",
    desc: "Book a live video call with a physiotherapist. They guide your exercises in real-time, log every movement, and the session data feeds into your AI dashboard.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Sign In", desc: "One-click Google sign-in to securely store your exercise data." },
  { step: "02", title: "Choose or Get a Plan", desc: "Browse the catalog or describe your injury and get an AI-generated rehab plan." },
  { step: "03", title: "Therapist Review", desc: "Your plan is sent to a physiotherapist for verification — they can approve, modify, or add notes." },
  { step: "04", title: "Exercise with AI", desc: "Position your webcam, start an exercise, and receive real-time pose feedback." },
  { step: "05", title: "Live Sessions", desc: "Book a live video session with a therapist who guides you through exercises in real-time." },
  { step: "06", title: "Track & Improve", desc: "View analytics, monitor your recovery score, and download progress reports." },
];

const EXERCISES = [
  { name: "Bridge", img: bridgeImg, tag: "Lower Back" },
  { name: "Squat", img: squatImg, tag: "Legs & Core" },
  { name: "Plank", img: plankImg, tag: "Core" },
  { name: "Push Up", img: pushUpImg, tag: "Upper Body" },
  { name: "Dead Bug", img: deadBugImg, tag: "Core & Back" },
  { name: "Shoulder Rolls", img: shoulderRollsImg, tag: "Mobility" },
];

const STATS = [
  { value: "16+", label: "Exercises" },
  { value: "AI", label: "Pose Tracking" },
  { value: "100%", label: "Free & Open" },
  { value: "24/7", label: "AI Assistant" },
];

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-landing">
      {/* ====== HERO ====== */}
      <section className="hero-section">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <img src={logo} alt="" className="hero-badge-logo" />
            <span>AI-Powered Physiotherapy</span>
          </div>
          <h1 className="hero-title">
            Your Personal <span className="hero-gradient">AI Physiotherapist</span>
          </h1>
          <p className="hero-subtitle">
            RehabOS uses computer vision and AI to guide your exercises in real time,
            build personalised rehabilitation plans, and track your recovery — all from your browser.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate("/catalog")}>
              Explore Exercises
            </button>
            <button className="btn-secondary" onClick={() => navigate("/rehab")}>
              Create Rehab Plan
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          {STATS.map((s, i) => (
            <div key={i} className="stat-item">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ====== FEATURES ====== */}
      <section className="section features-section">
        <div className="section-header">
          <span className="section-tag">Features</span>
          <h2 className="section-title">Everything You Need for Recovery</h2>
          <p className="section-subtitle">
            From real-time AI feedback to comprehensive analytics — RehabOS is a complete rehabilitation platform.
          </p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className="section how-section">
        <div className="section-header">
          <span className="section-tag">How It Works</span>
          <h2 className="section-title">Get Started in 5 Simple Steps</h2>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS.map((h, i) => (
            <div key={i} className="how-card">
              <span className="how-step">{h.step}</span>
              <h3 className="how-title">{h.title}</h3>
              <p className="how-desc">{h.desc}</p>
              {i < HOW_IT_WORKS.length - 1 && <div className="how-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ====== EXERCISE SHOWCASE ====== */}
      <section className="section exercises-section">
        <div className="section-header">
          <span className="section-tag">Exercise Library</span>
          <h2 className="section-title">16+ AI-Tracked Exercises</h2>
          <p className="section-subtitle">
            Each exercise comes with video instructions, real-time form correction, and automatic rep counting.
          </p>
        </div>
        <div className="exercises-showcase">
          {EXERCISES.map((ex, i) => (
            <div key={i} className="exercise-showcase-card" onClick={() => navigate("/catalog")}>
              <img src={ex.img} alt={ex.name} />
              <div className="exercise-showcase-info">
                <span className="exercise-showcase-tag">{ex.tag}</span>
                <h4>{ex.name}</h4>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => navigate("/catalog")} style={{ marginTop: "2rem" }}>
          View All Exercises
        </button>
      </section>

      {/* ====== THERAPIST PORTAL ====== */}
      <section className="section therapist-section">
        <div className="section-header">
          <span className="section-tag">For Physiotherapists</span>
          <h2 className="section-title">Professional Therapist Portal</h2>
          <p className="section-subtitle">
            A dedicated dashboard for physiotherapists to oversee patient recovery, review AI-generated plans, and monitor real-time analytics.
          </p>
        </div>
        <div className="therapist-features-grid">
          <div className="therapist-feature-card">
            <span className="feature-icon">📋</span>
            <h3 className="feature-title">Review & Approve Plans</h3>
            <p className="feature-desc">
              Every AI-generated rehab plan is sent for therapist verification. Approve, modify exercises (sets, reps, frequency), or reject with notes.
            </p>
          </div>
          <div className="therapist-feature-card">
            <span className="feature-icon">📈</span>
            <h3 className="feature-title">Monitor Patient Analytics</h3>
            <p className="feature-desc">
              View each patient's full AI analysis dashboard — recovery score, session charts, exercise progress, and consistency data.
            </p>
          </div>
          <div className="therapist-feature-card">
            <span className="feature-icon">🔒</span>
            <h3 className="feature-title">Secure & Separate</h3>
            <p className="feature-desc">
              Therapists have their own login, dashboard, and navigation — completely independent from the patient experience.
            </p>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => navigate("/therapist/login")} style={{ marginTop: "2rem" }}>
          Therapist Login / Sign Up
        </button>
      </section>

      {/* ====== LIVE SESSIONS ====== */}
      <section className="section live-session-section">
        <div className="section-header">
          <span className="section-tag">New Feature</span>
          <h2 className="section-title">Live Video Therapy Sessions</h2>
          <p className="section-subtitle">
            Connect face-to-face with a licensed physiotherapist through a real-time video call — right from your browser.
          </p>
        </div>
        <div className="therapist-features-grid">
          <div className="therapist-feature-card">
            <span className="feature-icon">📅</span>
            <h3 className="feature-title">Easy Booking</h3>
            <p className="feature-desc">
              Pick your preferred date and time, describe your injury, and submit a session request. A therapist reviews and confirms the appointment.
            </p>
          </div>
          <div className="therapist-feature-card">
            <span className="feature-icon">🎥</span>
            <h3 className="feature-title">Real-Time Video Call</h3>
            <p className="feature-desc">
              Join a WebRTC-powered video session at the scheduled time. Your therapist guides you through exercises with live camera and audio.
            </p>
          </div>
          <div className="therapist-feature-card">
            <span className="feature-icon">📝</span>
            <h3 className="feature-title">Exercise Logging</h3>
            <p className="feature-desc">
              During the session, your therapist logs every exercise — sets, reps, and notes. All data syncs to your AI Analysis dashboard and PDF reports.
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => navigate("/book-session")} style={{ marginTop: "2rem" }}>
          Book a Live Session
        </button>
      </section>

      {/* ====== CTA ====== */}
      <section className="cta-section">
        <div className="cta-glow" />
        <h2 className="cta-title">Ready to Start Your Recovery?</h2>
        <p className="cta-subtitle">
          Sign in with Google, describe your injury, and let AI build your personalised rehabilitation plan.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => navigate("/rehab")}>
            Get Your Rehab Plan
          </button>
          <button className="btn-secondary" onClick={() => navigate("/analysis")}>
            View AI Dashboard
          </button>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="home-footer">
        <p className="footer-disclaimer">{disclaimerText}</p>
        <p className="footer-copy">© {new Date().getFullYear()} RehabOS — AI-Powered Physiotherapy Platform</p>
      </footer>
    </div>
  );
}

export default Home;
