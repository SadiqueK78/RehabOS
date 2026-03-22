import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SearchIcon from "@mui/icons-material/Search";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SaveIcon from "@mui/icons-material/Save";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RepeatIcon from "@mui/icons-material/Repeat";
import TimerIcon from "@mui/icons-material/Timer";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import { Link } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { analyzeInjury, extractTextFromPDF } from "../utils/rehab/injuryAnalyzer";
import toast from "react-hot-toast";

function RehabPlan() {
  const auth = getAuth();
  const [isAuth, setIsAuth] = useState(false);
  const [injuryText, setInjuryText] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [existingPlan, setExistingPlan] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuth(true);
        await loadExistingPlan(user.email);
      } else {
        setIsAuth(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  const loadExistingPlan = async (email) => {
    try {
      const userDoc = await getDoc(doc(db, "users", email));
      if (userDoc.exists() && userDoc.data().rehabPlan) {
        setExistingPlan(userDoc.data().rehabPlan);
      }
    } catch (err) {
      console.error("Error loading rehab plan:", err);
    }
  };

  const handleAnalyzeText = () => {
    if (!injuryText.trim()) {
      toast.error("Please enter your injury details.");
      return;
    }
    setAnalyzing(true);
    const analysis = analyzeInjury(injuryText);
    setResult(analysis);
    setAnalyzing(false);
  };

  const handlePDFUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }

    setPdfFileName(file.name);
    setAnalyzing(true);

    try {
      const text = await extractTextFromPDF(file);
      if (!text.trim()) {
        toast.error("Could not extract text from the PDF. The file may be image-based.");
        setAnalyzing(false);
        return;
      }
      setInjuryText(text);
      const analysis = analyzeInjury(text);
      setResult(analysis);
    } catch (err) {
      console.error("PDF parsing error:", err);
      toast.error("Failed to parse PDF. Please try entering details manually.");
    }
    setAnalyzing(false);
  };

  const handleSavePlan = async () => {
    if (!isAuth) {
      toast.error("Please sign in to save your rehabilitation plan.");
      return;
    }
    if (!result || !result.found) return;

    setSaving(true);
    try {
      const plan = {
        injuryDescription: injuryText.substring(0, 2000),
        matchedConditions: result.matchedConditions,
        exercises: result.exercises.map((e) => e.id),
        exerciseDetails: result.exercises.map((e) => ({
          id: e.id,
          name: e.name,
          reps: e.reps,
          sets: e.sets,
          holdSeconds: e.holdSeconds,
          frequencyPerWeek: e.frequencyPerWeek,
          difficulty: e.difficulty,
          muscleGroup: e.muscleGroup,
        })),
        weeklySchedule: result.weeklySchedule,
        createdAt: Date.now(),
        status: "pending",
      };
      const userRef = doc(db, "users", auth.currentUser.email);
      await setDoc(userRef, { rehabPlan: plan, displayName: auth.currentUser.displayName || auth.currentUser.email }, { merge: true });
      setExistingPlan(plan);
      toast.success("Plan submitted for physiotherapist review!");
    } catch (err) {
      console.error("Error saving rehab plan:", err);
      toast.error("Failed to save plan.");
    }
    setSaving(false);
  };

  const handleClearPlan = async () => {
    if (!isAuth) return;
    try {
      const userRef = doc(db, "users", auth.currentUser.email);
      await setDoc(userRef, { rehabPlan: null }, { merge: true });
      setExistingPlan(null);
      setResult(null);
      setInjuryText("");
      toast.success("Rehabilitation plan cleared.");
    } catch (err) {
      console.error("Error clearing rehab plan:", err);
    }
  };

  return (
    <Box sx={{ padding: "1rem 2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <Typography variant="h1" sx={{ textAlign: "center", mb: "0.5rem" }}>
        Rehabilitation Plan
      </Typography>
      <Typography variant="body1" sx={{ textAlign: "center", color: "text.secondary", mb: "2rem" }}>
        Describe your injury or upload a medical report to get personalized exercise recommendations.
      </Typography>

      {/* Existing Plan Banner */}
      {existingPlan && (
        <Box sx={{ mb: "2rem" }}>
          <Alert
            severity={
              existingPlan.status === "approved" ? "success"
              : existingPlan.status === "rejected" ? "error"
              : "warning"
            }
            icon={
              existingPlan.status === "pending" ? <HourglassTopIcon /> : undefined
            }
            sx={{ borderRadius: "12px", mb: existingPlan.therapistNotes ? 1 : 0 }}
            action={
              <Button color="inherit" size="small" onClick={handleClearPlan}>
                Clear Plan
              </Button>
            }
          >
            {existingPlan.status === "pending" && (
              <>Your rehabilitation plan is <strong>awaiting physiotherapist review</strong>. Targeting:{" "}
              <strong>{existingPlan.matchedConditions.join(", ")}</strong> with{" "}
              {existingPlan.exercises.length} exercise{existingPlan.exercises.length !== 1 ? "s" : ""}.</>
            )}
            {existingPlan.status === "approved" && (
              <>Your rehabilitation plan has been <strong>approved by a physiotherapist</strong>! Targeting:{" "}
              <strong>{existingPlan.matchedConditions.join(", ")}</strong> with{" "}
              {existingPlan.exercises.length} exercise{existingPlan.exercises.length !== 1 ? "s" : ""}.{" "}
              Track your progress in the{" "}
              <Link to="/ai-analysis" style={{ color: "inherit", fontWeight: "bold" }}>
                AI Analysis Dashboard
              </Link>.</>
            )}
            {existingPlan.status === "rejected" && (
              <>Your rehabilitation plan was <strong>not approved</strong> by the physiotherapist. Please review the notes below and submit a new plan.</>
            )}
            {existingPlan.status === "active" && (
              <>You have an active rehabilitation plan targeting:{" "}
              <strong>{existingPlan.matchedConditions.join(", ")}</strong>.{" "}
              <Link to="/ai-analysis" style={{ color: "inherit", fontWeight: "bold" }}>
                AI Analysis Dashboard
              </Link>.</>
            )}
          </Alert>
          {existingPlan.therapistNotes && (
            <Alert severity="info" sx={{ borderRadius: "12px" }}>
              <strong>Physiotherapist Notes ({existingPlan.reviewedBy || "Therapist"}):</strong>{" "}
              {existingPlan.therapistNotes}
            </Alert>
          )}
        </Box>
      )}

      {/* Input Section */}
      <Card sx={{ mb: "2rem", borderRadius: "16px" }}>
        <CardContent sx={{ p: "2rem" }}>
          <Typography variant="h5" sx={{ mb: "1rem" }}>
            Describe Your Injury
          </Typography>

          <TextField
            multiline
            rows={5}
            fullWidth
            placeholder="E.g., I have lower back pain and knee stiffness from a sports injury. I also feel shoulder pain when lifting my arm..."
            value={injuryText}
            onChange={(e) => setInjuryText(e.target.value)}
            sx={{ mb: "1rem" }}
          />

          <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleAnalyzeText}
              disabled={analyzing}
            >
              Analyze Injury
            </Button>

            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              or
            </Typography>

            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={analyzing}
            >
              Upload PDF Report
              <input type="file" accept=".pdf" hidden onChange={handlePDFUpload} />
            </Button>

            {pdfFileName && (
              <Chip label={pdfFileName} onDelete={() => setPdfFileName("")} size="small" />
            )}
          </Box>

          {analyzing && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", mt: "1rem" }}>
              <CircularProgress size={24} />
              <Typography variant="body2">Analyzing injury details...</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <Box>
          {!result.found ? (
            <Alert severity="warning" sx={{ borderRadius: "12px", mb: "2rem" }}>
              {result.message}
            </Alert>
          ) : (
            <>
              <Alert severity="success" sx={{ borderRadius: "12px", mb: "1.5rem" }}>
                {result.message}
              </Alert>

              <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", mb: "1.5rem" }}>
                {result.matchedConditions.map((cond) => (
                  <Chip key={cond} label={cond} color="primary" variant="outlined" />
                ))}
              </Box>

              <Typography variant="h5" sx={{ mb: "1rem" }}>
                Recommended Exercises
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", mb: "2rem" }}>
                {result.exercises.map((exercise) => (
                  <Card
                    key={exercise.id}
                    sx={{
                      borderRadius: "14px",
                      transition: "transform 0.2s",
                      "&:hover": { transform: "translateY(-4px)" },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "0.5rem" }}>
                        <FitnessCenterIcon color="primary" />
                        <Typography variant="h6">{exercise.name}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: "0.75rem" }}>
                        {exercise.description}
                      </Typography>

                      {/* Plan Details */}
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", mb: "1rem" }}>
                        <Chip
                          icon={<RepeatIcon />}
                          label={exercise.holdSeconds > 0 ? `${exercise.sets} x ${exercise.holdSeconds}s hold` : `${exercise.sets} x ${exercise.reps} reps`}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                        <Chip
                          icon={<CalendarMonthIcon />}
                          label={`${exercise.frequencyPerWeek}x / week`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                        <Chip
                          icon={<TimerIcon />}
                          label={exercise.difficulty}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={exercise.muscleGroup}
                          size="small"
                          sx={{ bgcolor: "rgba(99,102,241,0.1)" }}
                        />
                      </Box>
                      <Button
                        component={Link}
                        to={`/exercise?exercise=${exercise.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                      >
                        Start Exercise
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {/* Weekly Schedule */}
              {result.weeklySchedule && (
                <Box sx={{ mb: "2rem" }}>
                  <Typography variant="h5" sx={{ mb: "1rem" }}>
                    <CalendarMonthIcon sx={{ verticalAlign: "middle", mr: "0.5rem" }} />
                    Weekly Rehabilitation Schedule
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                    {result.weeklySchedule.map((day) => (
                      <Card key={day.day} sx={{ borderRadius: "12px", bgcolor: day.exercises.length > 0 ? "rgba(34,197,94,0.05)" : "transparent", border: day.exercises.length > 0 ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(150,150,150,0.2)" }}>
                        <CardContent sx={{ p: "1rem !important" }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: "0.5rem" }}>
                            {day.dayName}
                          </Typography>
                          {day.exercises.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "text.disabled" }}>Rest Day</Typography>
                          ) : (
                            day.exercises.map((exId) => {
                              const ex = result.exercises.find((e) => e.id === exId);
                              return (
                                <Typography key={exId} variant="body2" sx={{ mb: "0.25rem" }}>
                                  {ex ? ex.name : exId}
                                </Typography>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
              )}

              {isAuth && (
                <Box sx={{ textAlign: "center" }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    onClick={handleSavePlan}
                    disabled={saving}
                    sx={{ borderRadius: "30px", px: "3rem" }}
                  >
                    {saving ? "Submitting..." : "Submit for Therapist Review"}
                  </Button>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: "0.5rem" }}>
                    Your plan will be reviewed by a physiotherapist before activation.
                  </Typography>
                </Box>
              )}

              {!isAuth && (
                <Alert severity="info" sx={{ borderRadius: "12px" }}>
                  Sign in to save your rehabilitation plan and track your recovery progress.
                </Alert>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

export default RehabPlan;
