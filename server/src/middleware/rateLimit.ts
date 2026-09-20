import rateLimit from "express-rate-limit";

// Rate limiting only gets in the way of the automated test suite.
const skip = () => process.env.NODE_ENV === "test";

/** Strict limiter for auth endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
  skip,
});

/** Looser limiter applied to the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});
