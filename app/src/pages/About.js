import React from "react";
import { Typography, Box, Grid2 } from "@mui/material";
import AboutCard from "../components/AboutCard";
import jamesImg from "../assets/about-profiles/james.png";
import anishImg from "../assets/about-profiles/anish.png";
import howellImg from "../assets/about-profiles/howell.png";
import jilinImg from "../assets/about-profiles/jilin.png";

function About() {
  return (
    <Box
      sx={{
        textAlign: "center",
        padding: "0.5rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}>
      <Typography variant="h1" sx={{ mb: "1rem" }}>
        Our Mission
      </Typography>

      <Box sx={{ textAlign: "left" }}>
        <Typography variant="body1" sx={{ mb: "3rem", mx: { xs: "1rem", lg: "10rem" } }}>
          We are actively developing a web application to assess physical therapy techniques and
          athletic movements with computer vision. Key concepts of our mission are integrating human
          pose detection models with video data that can accurately, efficiently, and constantly
          identify the user's current body position, as well as provide real-time feedback and
          guidance for the user to maintain the correct form during different physical activities,
          based on physiological literature. Our application features a catalog of exercises that
          users can quickly navigate to select their desired exercise and immediately start making
          improvements simply by activating their device camera. We hope and aim to positively
          impact fitness, physical therapy, and rehabilitation by improving exercise safety and
          effectiveness.
        </Typography>
      </Box>
    </Box>
  );
}

export default About;
