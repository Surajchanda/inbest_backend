import express from "express";
import {
  createUser,
  login,
  getMe,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../controllers/authController.js";
import {
  protect,
  isAdmin,
  isManagerOrAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", createUser);

router.use(protect);

router.get("/me", getMe);

router.get("/users", isManagerOrAdmin, getAllUsers);
router.put("/users/:id", isAdmin, updateUser);
router.delete("/users/:id", isAdmin, deleteUser);

export default router;
