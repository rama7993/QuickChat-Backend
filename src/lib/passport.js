const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../models/user");
const { getBackendBaseUrl } = require("../utils/environment");
const { URL } = require("url");

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
) {
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
} else {
}

if (
  process.env.LINKEDIN_CLIENT_ID &&
  process.env.LINKEDIN_CLIENT_SECRET &&
  process.env.LINKEDIN_CALLBACK_URL
) {
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
        scope: ["r_liteprofile"],
        profileFields: [
          "id",
          "first-name",
          "last-name",
          "email-address",
          "headline",
          "picture-url",
        ],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // console.log(
          //   "🔗 LinkedIn OAuth Profile:",
          //   JSON.stringify(profile, null, 2)
          // ); // Commented for production
          // console.log(
          //   "🔗 LinkedIn Profile JSON:",
          //   JSON.stringify(profile._json, null, 2)
          // ); // Commented for production

          let user = await User.findOne({
            providerId: profile.id,
            provider: "linkedin",
          });

          if (!user) {
            user = await User.create({
              firstName:
                profile.name?.givenName ||
                profile._json?.["first-name"] ||
                "LinkedIn",
              lastName:
                profile.name?.familyName ||
                profile._json?.["last-name"] ||
                "User",
              email:
                profile.emails?.[0]?.value ||
                profile._json?.["email-address"] ||
                `${profile.id}@linkedin.com`,
              provider: "linkedin",
              providerId: profile.id,
              photoUrl:
                profile.photos?.[0]?.value ||
                profile._json?.["picture-url"] ||
                "",
            });
          }

          return done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
} else {
}
