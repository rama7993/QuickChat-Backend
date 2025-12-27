const Joi = require("joi");

const userSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email":
        "Please enter a valid email address in the format 'example@domain.com'.",
      "any.required": "Email is required.",
    }),
}).unknown(true); //to allow other keys like firstName, lastName, etc.

const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email": "Please enter a valid email address.",
      "any.required": "Email is required.",
    }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "any.required": "Reset token is required.",
    "string.empty": "Reset token cannot be empty.",
  }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),
});

const validateUser = (req) => {
  const { error } = userSchema.validate(req.body, { abortEarly: false });
  if (error) {
    // Combine all error messages into one string
    throw new Error(error.details.map((d) => d.message).join(", "));
  }
};

const validateForgotPassword = (req) => {
  const { error } = forgotPasswordSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    throw new Error(error.details.map((d) => d.message).join(", "));
  }
};

const validateResetPassword = (req) => {
  const { error } = resetPasswordSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    throw new Error(error.details.map((d) => d.message).join(", "));
  }
};

module.exports = {
  validateUser,
  validateForgotPassword,
  validateResetPassword,
};
