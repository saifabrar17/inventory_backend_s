const axios = require("axios");

const verifyTurnstile = async (token) => {
  try {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
      throw new Error("Missing TURNSTILE_SECRET_KEY");
    }

    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret,
        response: token,
      })
    );

    return response.data;
  } catch (error) {
    console.error("Turnstile error:", error.message);
    return { success: false };
  }
};

module.exports = { verifyTurnstile };