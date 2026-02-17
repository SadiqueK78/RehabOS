import React from "react";
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CardMedia,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import catalogPreview from "../assets/logos/catalogPreview.png";
import { disclaimerText } from "../assets/content";

function Home() {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/catalog");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        gap: "2rem",
      }}
    >
      {/* Header Section */}
      <Box>
        <Typography variant="h1" sx={{ mb: "0.5rem" }}>
          Welcome to RehabOS!
        </Typography>
        <Typography variant="h5" sx={{ mb: "0.75rem" }}>
          AI-powered App for Fitness & Rehabilitation
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Providing real-time feedback on exercise form using state-of-the-art
          computer vision models.
        </Typography>
      </Box>

      {/* Centered Catalog Card */}
      <Card
        sx={{
          width: "36rem",
          cursor: "pointer",
          transition: "transform 0.3s",
          borderRadius: "2rem",
          "&:hover": {
            transform: "scale(1.05)",
          },
        }}
        onClick={handleNavigate}
      >
        <CardMedia
          component="img"
          image={catalogPreview}
          alt="Exercise Catalog Preview"
        />
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Explore Our Catalog
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            gutterBottom
          >
            Discover a variety of exercises tailored to your fitness and rehab
            needs.
          </Typography>
          <Button variant="contained" color="secondary" sx={{ mt: "0.5rem" }}>
            Go to Catalog
          </Button>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: "60rem" }}
      >
        {disclaimerText}
      </Typography>
    </Box>
  );
}

export default Home;
