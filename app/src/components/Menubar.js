import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Chip,
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import exerSightsLogo from "../assets/logos/logoNoName.png";
import exerSightsNameWhite from "../assets/logos/productNameWhite.png";
import exerSightsNameBlack from "../assets/logos/productNameBlack.png";
import HomeIcon from "@mui/icons-material/Home";
import ListIcon from "@mui/icons-material/List";
import InfoIcon from "@mui/icons-material/Info";
import EmailIcon from "@mui/icons-material/Email";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import HealingIcon from "@mui/icons-material/Healing";
import VideocamIcon from "@mui/icons-material/Videocam";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InsightsIcon from "@mui/icons-material/Insights";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import GoogleIcon from "@mui/icons-material/Google";
import ElderlyIcon from "@mui/icons-material/Elderly";
import { auth, provider } from "../firebaseConfig";
import { useDemo, startDemo, exitDemo, DEMO_USER } from "../utils/patient/demoPatient";

// Always visible on wide screens; the rest live under "More".
const PRIMARY = [
  { text: "HOME", path: "/home", icon: <HomeIcon /> },
  { text: "HEALTH", path: "/digital-twin", icon: <MonitorHeartIcon /> },
  { text: "CATALOG", path: "/catalog", icon: <ListIcon /> },
  { text: "REHAB", path: "/rehab-plan", icon: <HealingIcon /> },
  { text: "SESSIONS", path: "/book-session", icon: <VideocamIcon /> },
];
const MORE = [
  { text: "PROGRAM", path: "/program", icon: <ContentPasteIcon /> },
  { text: "AI ANALYSIS", path: "/ai-analysis", icon: <AutoGraphIcon /> },
  { text: "FAQ", path: "/faq", icon: <EmailIcon /> },
  { text: "ABOUT", path: "/about", icon: <InfoIcon /> },
];

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

/**
 * Menubar is the top navigation bar. On wide screens it shows the main pages, a "More" menu
 * and an account menu; on narrow screens everything moves into a drawer.
 * Signed-out visitors can sign in with Google or try the demo patient account.
 *
 * @component
 * @returns {JSX.Element} A Material UI AppBar with navigation links.
 */
function Menubar(props) {
  const location = useLocation();
  const navigate = useNavigate();
  const demo = useDemo();

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [accountAnchor, setAccountAnchor] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  const user = demo.active ? DEMO_USER : firebaseUser;
  const displayName = user?.displayName || user?.email || "";

  const closeMenus = () => {
    setMoreAnchor(null);
    setAccountAnchor(null);
    setIsDrawerOpen(false);
  };

  const handleLogin = async () => {
    closeMenus();
    try {
      exitDemo(); // a real account replaces the demo
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error: ", error);
    }
  };

  const handleDemo = () => {
    closeMenus();
    startDemo();
    navigate("/dashboard");
  };

  const handleLogout = () => {
    closeMenus();
    if (demo.active) {
      exitDemo();
      navigate("/home");
      return;
    }
    signOut(auth)
      .then(() => {
        if (location.pathname === "/myExerSights") navigate("/home");
      })
      .catch((error) => console.error("Error logging out:", error));
  };

  const navButton = (item) => {
    const active = location.pathname === item.path;
    return (
      <Button
        key={item.text}
        component={Link}
        to={item.path}
        startIcon={item.icon}
        sx={{
          color: "text.primary",
          fontWeight: active ? 700 : 500,
          fontSize: 15,
          px: 1.25,
          whiteSpace: "nowrap",
          borderRadius: 5,
          bgcolor: active ? "action.selected" : "transparent",
        }}>
        {item.text}
      </Button>
    );
  };

  return (
    <AppBar position="static" elevation={8} sx={{ mt: "0.25rem", mb: "1rem", borderRadius: "3rem" }}>
      <Toolbar sx={{ gap: 1 }}>
        {/* logo */}
        <Box component={Link} to="/" sx={{ display: "flex", alignItems: "center", flexShrink: 0, mr: 1 }}>
          <Box component="img" src={exerSightsLogo} alt="RehabOS" sx={{ height: 56, width: 56 }} />
          <Box
            component="img"
            src={props.darkMode ? exerSightsNameWhite : exerSightsNameBlack}
            alt=""
            sx={{ height: 30, width: { xs: 170, xl: 200 }, ml: 0.5, display: { xs: "none", sm: "block" } }}
          />
        </Box>

        {/* desktop navigation */}
        <Box sx={{ display: { xs: "none", lg: "flex" }, flex: 1, justifyContent: "center", alignItems: "center", gap: 0.25, minWidth: 0 }}>
          {PRIMARY.map(navButton)}
          <Button
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            endIcon={<ExpandMoreIcon />}
            sx={{ color: "text.primary", fontWeight: 500, fontSize: 15, px: 1.25, whiteSpace: "nowrap", borderRadius: 5 }}>
            MORE
          </Button>
          <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
            {MORE.map((item) => (
              <MenuItem key={item.text} component={Link} to={item.path} onClick={closeMenus}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                {item.text}
              </MenuItem>
            ))}
          </Menu>
        </Box>

        {/* dark mode + account */}
        <Box sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", gap: 1, flexShrink: 0 }}>
          <IconButton onClick={props.toggleDarkMode} sx={{ color: "text.primary" }} aria-label="Toggle dark mode">
            {props.darkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          {user ? (
            <Button
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              endIcon={<ExpandMoreIcon />}
              sx={{ color: "text.primary", textTransform: "none", borderRadius: 5, pl: 0.75 }}
              aria-label="Account menu">
              <Avatar src={user.photoURL || undefined} sx={{ width: 34, height: 34, mr: 1, fontSize: 15, fontWeight: 700, bgcolor: "background.paper", color: "text.primary" }}>
                {initials(displayName)}
              </Avatar>
              <Box sx={{ textAlign: "left", maxWidth: 140 }}>
                <Typography noWrap sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                  {displayName.split(" ")[0]}
                </Typography>
                {demo.active && (
                  <Typography noWrap sx={{ fontSize: 11, lineHeight: 1.2, opacity: 0.8 }}>
                    Demo patient
                  </Typography>
                )}
              </Box>
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="inherit"
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              startIcon={<LoginIcon />}
              sx={{ borderRadius: 5, whiteSpace: "nowrap", color: "text.primary" }}>
              LOGIN
            </Button>
          )}
          <Menu anchorEl={accountAnchor} open={!!accountAnchor} onClose={() => setAccountAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            {user
              ? [
                  <Box key="who" sx={{ px: 2, py: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{displayName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {demo.active ? "Demo account · saved in this browser only" : user.email}
                    </Typography>
                  </Box>,
                  <Divider key="d1" />,
                  <MenuItem key="dash" component={Link} to="/dashboard" onClick={closeMenus}>
                    <ListItemIcon>
                      <HomeIcon fontSize="small" />
                    </ListItemIcon>
                    My dashboard
                  </MenuItem>,
                  <MenuItem key="health" component={Link} to="/digital-twin" onClick={closeMenus}>
                    <ListItemIcon>
                      <MonitorHeartIcon fontSize="small" />
                    </ListItemIcon>
                    My health
                  </MenuItem>,
                  <MenuItem key="progress" component={Link} to="/myExerSights" onClick={closeMenus}>
                    <ListItemIcon>
                      <InsightsIcon fontSize="small" />
                    </ListItemIcon>
                    My progress
                  </MenuItem>,
                  <Divider key="d2" />,
                  <MenuItem key="out" onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    {demo.active ? "Exit demo" : "Logout"}
                  </MenuItem>,
                ]
              : [
                  <MenuItem key="google" onClick={handleLogin}>
                    <ListItemIcon>
                      <GoogleIcon fontSize="small" />
                    </ListItemIcon>
                    Sign in with Google
                  </MenuItem>,
                  <MenuItem key="demo" onClick={handleDemo}>
                    <ListItemIcon>
                      <ElderlyIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Try demo patient" secondary="Ramesh, 72 · knee replacement" />
                  </MenuItem>,
                ]}
          </Menu>
        </Box>

        {/* drawer icon */}
        <Box sx={{ display: { xs: "flex", lg: "none" }, flex: 1, justifyContent: "flex-end", alignItems: "center", gap: 1 }}>
          {demo.active && <Chip size="small" label="Demo" color="secondary" />}
          <IconButton onClick={() => setIsDrawerOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
        </Box>

        {/* mobile drawer */}
        <Drawer anchor="right" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} sx={{ display: { xs: "block", lg: "none" }, "& .MuiDrawer-paper": { width: 280, maxWidth: "85vw" } }}>
          {user && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
              <Avatar src={user.photoURL || undefined} sx={{ bgcolor: "secondary.main" }}>
                {initials(displayName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700 }}>
                  {displayName}
                </Typography>
                <Typography noWrap variant="body2" color="text.secondary">
                  {demo.active ? "Demo patient" : user.email}
                </Typography>
              </Box>
            </Box>
          )}
          <List>
            {[...PRIMARY, ...MORE].map((item) => (
              <ListItemButton key={item.text} component={Link} to={item.path} onClick={closeMenus} selected={location.pathname === item.path}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            ))}
            {user && (
              <ListItemButton component={Link} to="/myExerSights" onClick={closeMenus}>
                <ListItemIcon>
                  <InsightsIcon />
                </ListItemIcon>
                <ListItemText primary="MY PROGRESS" />
              </ListItemButton>
            )}
            <Divider sx={{ my: 1 }} />
            {user ? (
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary={demo.active ? "EXIT DEMO" : "LOGOUT"} />
              </ListItemButton>
            ) : (
              <>
                <ListSubheader disableSticky>Account</ListSubheader>
                <ListItemButton onClick={handleLogin}>
                  <ListItemIcon>
                    <GoogleIcon />
                  </ListItemIcon>
                  <ListItemText primary="Sign in with Google" />
                </ListItemButton>
                <ListItemButton onClick={handleDemo}>
                  <ListItemIcon>
                    <ElderlyIcon />
                  </ListItemIcon>
                  <ListItemText primary="Try demo patient" secondary="Ramesh, 72 · knee replacement" />
                </ListItemButton>
              </>
            )}
            <ListItemButton onClick={props.toggleDarkMode}>
              <ListItemIcon>{props.darkMode ? <LightModeIcon /> : <DarkModeIcon />}</ListItemIcon>
              <ListItemText primary={props.darkMode ? "LIGHT MODE" : "DARK MODE"} />
            </ListItemButton>
          </List>
        </Drawer>
      </Toolbar>
    </AppBar>
  );
}
export default Menubar;
