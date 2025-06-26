function setTokenCookie(res, token) {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // for HTTPS
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' only with HTTPS
    expires: new Date(Date.now() + oneWeek),
    path: "/", // for full site access
  });
}

function clearTokenCookie(res) {
  res.cookie("token", null, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(Date.now()), // expire immediately
  });
}

module.exports = {
  setTokenCookie,
  clearTokenCookie,
};
