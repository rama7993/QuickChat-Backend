const express = require("express");
const router = express.Router();
const passport = require("passport");
const { authMiddleware } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/errorHandler");
const authController = require("../controllers/authController");
const { getFrontendBaseUrl } = require("../utils/environment");

router.use(passport.initialize());

router.post("/login", asyncHandler(authController.login));

router.post("/demo", asyncHandler(authController.loginDemo));

router.post("/refresh", authMiddleware, asyncHandler(authController.refreshToken));

router.post("/logout", authController.logout);

router.get("/validate", authMiddleware, asyncHandler(authController.validateToken));

router.post("/register", asyncHandler(authController.register));

router.post("/change-password", authMiddleware, asyncHandler(authController.changePassword));

router.post("/forgot-password", asyncHandler(authController.forgotPassword));

router.post("/reset-password", asyncHandler(authController.resetPassword));

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  authController.googleCallback
);

router.get("/linkedin", passport.authenticate("linkedin", { session: false }));

router.get(
  "/linkedin/callback",
  (req, res, next) => {
    if (req.query.error) {
      return res.redirect(
        `${getFrontendBaseUrl()}/login?error=linkedin_oauth_error&message=${encodeURIComponent(
          req.query.error_description || req.query.error
        )}`
      );
    }
    next();
  },
  passport.authenticate("linkedin", {
    session: false,
    failureRedirect: `${getFrontendBaseUrl()}/login?error=linkedin_auth_failed`,
  }),
  authController.linkedinCallback
);

module.exports = router;
