import { React, useState } from "react";
import { Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContactForm from "../components/ContactForm";
import "./FAQ.css";

const categories = [
  {
    title: "Getting Started",
    icon: "🚀",
    faqs: [
      {
        q: "Is RehabOS free to use?",
        a: "Yes! RehabOS is 100% free to use. It's also fully open-source.",
      },
      {
        q: "How do I sign in?",
        a: "Click the Sign In button in the navbar and use your Google account. This lets you save exercise history, preferences, programs, and rehab plans across devices.",
      },
      {
        q: "What happens to my personal data?",
        a: "Absolutely nothing beyond what's needed. RehabOS stores exercise history and plan data in Firebase linked to your email. We never share or sell personal data.",
      },
      {
        q: "What browser should I use?",
        a: "We recommend Google Chrome for the best experience. If something isn't working, try a hard refresh (Ctrl+Shift+R) to clear cached content.",
      },
    ],
  },
  {
    title: "AI Pose Detection & Exercises",
    icon: "🤖",
    faqs: [
      {
        q: "How does pose detection work?",
        a: "RehabOS uses Google's MediaPipe framework to track 33 body landmarks via your webcam. It computes joint angles in real time to identify exercise phases, count reps, and provide form feedback — no wearables needed.",
      },
      {
        q: "What are the ideal conditions for using RehabOS?",
        a: "Ensure your full body is in frame, you're the only person visible, your clothing contrasts with the background, the room is well-lit, and you follow the camera setup instructions in the Help tab on each exercise page.",
      },
      {
        q: "Can I use it with multiple people in frame?",
        a: "We don't recommend it for regular exercises — the model may not track the correct person. However, we have a two-player Push-Up Game and Squat Game where two people can compete simultaneously!",
      },
      {
        q: "How many exercises are available?",
        a: "RehabOS offers 16+ AI-tracked exercises including Squat, Push-Up, Plank, Dead Bug, Bridge, Lunge, Leg Raise, Shoulder Press, Tree Pose, and more. Each comes with a tutorial video, real-time feedback, and automatic rep counting.",
      },
      {
        q: "Can I customise exercise settings?",
        a: "Yes! Each exercise page has a Settings tab where you can adjust target angles, rep thresholds, and other parameters to match your personal needs and ability level.",
      },
    ],
  },
  {
    title: "Rehabilitation Plans",
    icon: "🩺",
    faqs: [
      {
        q: "How do I create a rehab plan?",
        a: "Navigate to the Rehab page, describe your injury or condition, and our AI will generate a personalised weekly exercise plan with specific exercises, sets, reps, frequency, and a weekly schedule.",
      },
      {
        q: "What happens after I submit a rehab plan?",
        a: "Your plan is submitted with a \"Pending\" status and sent for physiotherapist review. A licensed therapist will review, potentially modify, and either approve or reject it with notes.",
      },
      {
        q: "Can I see my plan before it's approved?",
        a: "You can view the plan status on the Rehab page, but the detailed rehab analytics and recovery score on the AI Analysis page will only appear once the plan is approved by a therapist.",
      },
      {
        q: "What if the therapist modifies my plan?",
        a: "If a therapist adjusts exercises, reps, sets, frequency, adds new exercises, or removes some, those changes are automatically reflected in your plan and AI Analysis dashboard once approved.",
      },
    ],
  },
  {
    title: "Therapist Portal",
    icon: "👨‍⚕️",
    faqs: [
      {
        q: "What is the Therapist Portal?",
        a: "It's a dedicated, separate dashboard for licensed physiotherapists. Therapists have their own login, navigation, and tools — completely independent from the patient-facing app.",
      },
      {
        q: "How do I sign up as a therapist?",
        a: "Click the therapist login option on the welcome modal, or navigate to the Therapist Login page. Sign up with your email, name, license number, and specialisation. Therapist accounts use email/password authentication.",
      },
      {
        q: "What can therapists do?",
        a: "Therapists can review pending rehab plans, approve/reject/modify plans (including adding new exercises), leave notes for patients, view full patient AI analytics, recovery scores, and monitor individual patient progress in real time.",
      },
      {
        q: "How does the Monitor Patient feature work?",
        a: "In the Patient Analytics tab, click \"Monitor Patient\" on any patient card. This opens a full AI Analysis view for that patient — the same charts, recovery score, exercise progress, and rehab plan details the patient sees.",
      },
    ],
  },
  {
    title: "AI Analysis & Recovery Score",
    icon: "📊",
    faqs: [
      {
        q: "What is the AI Analysis Dashboard?",
        a: "It's a comprehensive analytics page showing your exercise performance — total sessions, reps, duration, charts (reps over time, exercise distribution, average reps per exercise), and if you have an approved rehab plan, detailed recovery analytics.",
      },
      {
        q: "How is the Recovery Score calculated?",
        a: "The Recovery Score (0–100) is made up of four components: Sessions (30 pts) — how many rehab sessions you've completed vs expected; Coverage (20 pts) — how many plan exercises you've done; Consistency (25 pts) — how many of the last 7 days you exercised; Improvement (25 pts) — whether your reps are trending up.",
      },
      {
        q: "What is the streak system?",
        a: "Your streak counts consecutive days with at least one exercise session. Streaks of 3+ days show a fire emoji, and 7+ days show double fire. It's displayed alongside your recovery score to keep you motivated.",
      },
      {
        q: "Can I download or email my report?",
        a: "Yes! Click \"Download & Email Report\" on the AI Analysis page. It generates a comprehensive PDF with all your analytics, plan details, and session history — and emails it to your registered address via SMTP.",
      },
    ],
  },
  {
    title: "Physio Chatbot",
    icon: "💬",
    faqs: [
      {
        q: "What is the Physio Chatbot?",
        a: "It's an AI-powered assistant (Gemini 2.5 Pro) available on every page via the chat bubble in the bottom-right. Ask any physiotherapy question and get detailed, evidence-based answers.",
      },
      {
        q: "Can the chatbot recommend exercises?",
        a: "Yes! When you ask about specific conditions or exercises, the chatbot provides structured responses with embedded instruction videos and direct links to start exercises in RehabOS.",
      },
      {
        q: "Is the chatbot a replacement for a real therapist?",
        a: "No. The chatbot provides general physiotherapy guidance, but it's not a substitute for professional medical advice. Always consult a licensed physiotherapist for personalised treatment — which is why RehabOS also includes the Therapist Portal.",
      },
    ],
  },
  {
    title: "Accuracy & Limitations",
    icon: "⚠️",
    faqs: [
      {
        q: "Can I trust RehabOS for accurate feedback?",
        a: "We've developed RehabOS with accuracy in mind, but we cannot guarantee 100% correctness. Exercise feedback and stats may not always be accurate. Always consult a professional trainer before performing exercises. Use at your own risk.",
      },
      {
        q: "What can RehabOS NOT do?",
        a: "Since RehabOS relies on joint angle analysis via webcam, it's possible to \"cheat\" by positioning your limbs without actually performing exercises. It also can't detect muscle engagement, breathing, or internal pain — which is why therapist oversight is built into the platform.",
      },
      {
        q: "A feature isn't working. What should I do?",
        a: "First, make sure you're using Google Chrome. Try a hard refresh (Ctrl+Shift+R). If the issue persists, use the contact form below — we'd love to help!",
      },
    ],
  },
];

const FAQItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`faq-item ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
      <div className="faq-question">
        <span>{q}</span>
        <ExpandMoreIcon className={`faq-chevron ${open ? "rotated" : ""}`} />
      </div>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
};

function FAQ() {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="faq-root">
      {/* Hero */}
      <div className="faq-hero">
        <div className="faq-hero-glow" />
        <Typography variant="h2" className="faq-hero-title">
          Frequently Asked Questions
        </Typography>
        <Typography className="faq-hero-subtitle">
          Everything you need to know about RehabOS — exercises, rehab plans, therapist portal, AI analytics, and more.
        </Typography>
      </div>

      {/* Category Pills */}
      <div className="faq-categories">
        {categories.map((cat, i) => (
          <button
            key={i}
            className={`faq-category-pill ${activeCategory === i ? "active" : ""}`}
            onClick={() => setActiveCategory(i)}
          >
            <span className="pill-icon">{cat.icon}</span>
            <span>{cat.title}</span>
          </button>
        ))}
      </div>

      {/* FAQ Content */}
      <div className="faq-content">
        <div className="faq-section-header">
          <span className="faq-section-icon">{categories[activeCategory].icon}</span>
          <h2>{categories[activeCategory].title}</h2>
        </div>
        <div className="faq-list">
          {categories[activeCategory].faqs.map((faq, i) => (
            <FAQItem key={`${activeCategory}-${i}`} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="faq-stats">
        <div className="faq-stat">
          <span className="faq-stat-value">{categories.reduce((s, c) => s + c.faqs.length, 0)}</span>
          <span className="faq-stat-label">Questions Answered</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-value">{categories.length}</span>
          <span className="faq-stat-label">Categories</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-value">16+</span>
          <span className="faq-stat-label">AI Exercises</span>
        </div>
      </div>

      {/* Contact */}
      <div className="faq-contact">
        <h2>Still Have Questions?</h2>
        <p>We'd love to hear from you. Send us a message and we'll get back to you.</p>
        <ContactForm />
      </div>
    </div>
  );
}

export default FAQ;
