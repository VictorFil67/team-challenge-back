import {
  recoverPassword,
  register,
  // setToken,
  setTokens,
  updateUser,
} from "../services/authServices.js";
import ctrlWrapper from "../decorators/ctrlWrapper.js";
import HttpError from "../helpers/HttpError.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUser } from "../services/userServices.js";
import "dotenv/config"; // Вместо этого можно:
// import dotenv from "dotenv";
// dotenv.config();
import { generateRandomCode } from "../helpers/generateRandomCode.js";
import sendEmail from "../helpers/sendEmail.js";

const { JWT_SECRET, DEPLOY_HOST } = process.env;

const signup = async (req, res) => {
  const { email } = req.body;
  const user = await findUser({ email });
  if (user) {
    throw HttpError(409, "Email in use");
  }
  const newUser = await register(req.body);
  res.status(201).json({
    user: {
      name: newUser.name,
      email: newUser.email,
      residential_complex: newUser.residential_complex,
      apartment: newUser.apartment,
      entrance: newUser.entrance,
    },
  });
};

const signin = async (req, res) => {
  const { email, password } = req.body;
  const user = await findUser({ email });
  if (!user) {
    throw HttpError(401, "Email or password is wrong");
  }
  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Email or password is wrong");
  }
  const payload = {
    id: user._id,
  };
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });

  await setTokens(user.id, token, refreshToken);
  res.json({
    token,
    refreshToken,
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
  });
};

const getCurrent = async (req, res) => {
  const { name, email, residential_complex, apartment, entrance, phone } =
    req.user;
  res.json({
    name,
    email,
    residential_complex,
    apartment,
    entrance,
    phone,
  });
};

const getrefreshCurrent = async (req, res) => {
  const user = req.user;
  const payload = {
    id: user._id,
  };
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
  await setTokens(user.id, token, refreshToken);
  res.json({
    token,
    refreshToken,
  });
};

const logout = async (req, res) => {
  const { _id } = req.user;
  await setTokens(_id);
  res.status(204).json();
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await findUser({ email });
  if (!user) {
    throw HttpError(404, "User not found");
  }

  const tempCode = generateRandomCode();

  await updateUser({ email }, { tempCode });
  const userEmail = {
    to: email,
    subject: "Forgot password",
    html: `
        <h1>Hello, did you forget your password?</h1>
        <p>If no, ignore this email.</p>
        <p>Otherwise, please click on the link below:</p>
        <div style="margin-bottom: 20px;">
          <a href="${DEPLOY_HOST}/update-password/${tempCode}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #407bff; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">Click to update your password!</a>
        </div>
        `,
  };

  await sendEmail(userEmail);

  res.json({
    message:
      "An email has been sent to your email address to recover your password",
  });
};

const updatePassword = async (req, res) => {
  const { tempCode } = req.params;
  const { newPassword } = req.body;

  const user = await findUser({ tempCode });
  if (!user) {
    throw HttpError(404, "User not found");
  }

  await recoverPassword(tempCode, {
    password: newPassword,
    tempCode: undefined,
  });

  res.status(200).json({
    message: "Your password has been updated successfully",
  });
};

export default {
  signup: ctrlWrapper(signup),
  signin: ctrlWrapper(signin),
  getCurrent: ctrlWrapper(getCurrent),
  getrefreshCurrent: ctrlWrapper(getrefreshCurrent),
  logout: ctrlWrapper(logout),
  forgotPassword: ctrlWrapper(forgotPassword),
  updatePassword: ctrlWrapper(updatePassword),
};
