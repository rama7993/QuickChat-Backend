const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../models/user");
const { getBackendBaseUrl } = require("../utils/environment");
require("dotenv").config();
const { URL } = require("url");

const googleCallbackUrl = new URL(
  process.env.GOOGLE_CALLBACK_URL,
  getBackendBaseUrl()
).href;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: googleCallbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          providerId: profile.id,
          provider: "google",
        });

        if (!user) {
          // Optional: Check for existing email to link account
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            user.provider = "google";
            user.providerId = profile.id;
            await user.save();
          } else {
            user = await User.create({
              firstName: profile.name.givenName || "",
              lastName: profile.name.familyName || "",
              email: profile.emails[0].value,
              provider: "google",
              providerId: profile.id,
              photoUrl: profile.photos?.[0]?.value || "",
            });
          }
        }

        return done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

const linkedinCallbackUrl = new URL(
  process.env.LINKEDIN_CALLBACK_URL,
  getBackendBaseUrl()
).href;

passport.use(
  new LinkedInStrategy(
    {
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: linkedinCallbackUrl,

      scope: ["r_emailaddress", "r_liteprofile"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          providerId: profile.id,
          provider: "linkedin",
        });

        if (!user) {
          // Optional: Check for existing email
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            user.provider = "linkedin";
            user.providerId = profile.id;
            await user.save();
          } else {
            user = await User.create({
              firstName: profile.name.givenName || "",
              lastName: profile.name.familyName || "",
              email: profile.emails[0].value,
              provider: "linkedin",
              providerId: profile.id,
              photoUrl: profile.photos?.[0]?.value || "",
            });
          }
        }

        return done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);
