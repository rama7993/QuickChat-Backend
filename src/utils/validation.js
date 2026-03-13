const { z } = require("zod");

const userSchema = z.object({
  email: z.email({
    required_error: "Email is required.",
    invalid_type_error:
      "Please enter a valid email address in the format 'example@domain.com'.",
  }),
});

const forgotPasswordSchema = z.object({
  email: z.email({
    required_error: "Email is required.",
    invalid_type_error: "Please enter a valid email address.",
  }),
});

const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: "Reset token is required." })
    .min(1, "Reset token cannot be empty."),
  password: z
    .string({ required_error: "Password is required." })
    .min(8, "Password must be at least 8 characters long."),
});

const validateUser = (req) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    throw new Error(result.error.issues.map((e) => e.message).join(", "));
  }
};

const validateForgotPassword = (req) => {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    throw new Error(result.error.issues.map((e) => e.message).join(", "));
  }
};

const validateResetPassword = (req) => {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    throw new Error(result.error.issues.map((e) => e.message).join(", "));
  }
};

module.exports = {
  validateUser,
  validateForgotPassword,
  validateResetPassword,
};
