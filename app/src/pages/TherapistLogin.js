import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./TherapistLogin.css";

function TherapistLogin() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [specialization, setSpecialization] = useState("");

  const handleSignUp = async () => {
    if (!email || !password || !name || !license) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      await setDoc(doc(db, "therapists", cred.user.uid), {
        email,
        name,
        license,
        specialization,
        role: "therapist",
        createdAt: Date.now(),
      });

      toast.success("Account created! Welcome, " + name);
      navigate("/therapist/dashboard");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in.");
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const therapistDoc = await getDoc(doc(db, "therapists", cred.user.uid));
      if (!therapistDoc.exists()) {
        await auth.signOut();
        setError("No therapist account found. Please sign up first.");
        setLoading(false);
        return;
      }

      toast.success("Welcome back, " + (cred.user.displayName || "Therapist"));
      navigate("/therapist/dashboard");
    } catch (err) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Invalid email or password.");
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  return (
    <Box className="therapist-login-page">
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/")}
        sx={{
          position: "absolute",
          top: 24,
          left: 24,
          textTransform: "none",
          color: "text.secondary",
        }}
      >
        Back to RehabOS
      </Button>
      <Card className="therapist-login-card">
        <CardContent sx={{ p: "2.5rem" }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <LocalHospitalIcon sx={{ fontSize: 48, color: "#6366f1", mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Physiotherapist Portal
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {isSignUp
                ? "Create your therapist account"
                : "Sign in to monitor patients"}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {isSignUp && (
            <>
              <TextField
                fullWidth
                label="Full Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="License Number *"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Specialization"
                placeholder="e.g. Sports Injury, Orthopedic"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                sx={{ mb: 2 }}
              />
            </>
          )}

          <TextField
            fullWidth
            label="Email *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Password *"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}
            sx={{
              py: 1.5,
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 3,
              textTransform: "none",
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography
            variant="body2"
            sx={{ textAlign: "center", color: "text.secondary" }}
          >
            {isSignUp ? "Already have an account?" : "Don't have a therapist account?"}{" "}
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </Button>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default TherapistLogin;
