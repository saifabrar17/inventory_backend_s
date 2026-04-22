const { default: axios } = require("axios");


const verifyCaptcha = async (token) => {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;

    if (!secret) {
      throw new Error("Missing RECAPTCHA_SECRET_KEY");
    }

    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret,
          response: token,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Captcha verification error:", error.message);
    return { success: false };
  }
};

module.exports = { verifyCaptcha };