import Razorpay from "razorpay";

const keyId = process.env.RZP_API_KEY;
const keySecret = process.env.RZP_API_SECRET;

if (!keyId) {
  throw new Error(
    "RZP_API_KEY is missing from environment variables"
  );
}

if (!keySecret) {
  throw new Error(
    "RZP_API_SECRET is missing from environment variables"
  );
}

export const razorpay =
  new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

export const razorpayKeyId =
  keyId;