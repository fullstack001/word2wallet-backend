import { Router } from "express";
import { BlogController } from "../controllers/blogController";
import { CommentController } from "../controllers/commentController";
import { ReactionController } from "../controllers/reactionController";
import { authenticate, requireAdmin, optionalAuth } from "../middleware/auth";
import {
  createBlogValidation,
  updateBlogValidation,
  blogIdValidation,
  blogIdParamValidation,
  createCommentValidation,
  updateCommentValidation,
  createReactionValidation,
} from "../validation/blogValidation";

const router = Router();

// Protected routes (require authentication) - Must come before parameterized routes
router.get("/", authenticate, BlogController.getBlogs);

// Public routes - Must come after exact match routes
router.get("/published", BlogController.getPublishedBlogs);
router.get("/recent", BlogController.getRecentBlogs);

// Parameterized routes (must come after exact matches)
router.get("/:id/public", blogIdValidation, BlogController.getBlogById);
router.get("/:id/related", blogIdValidation, BlogController.getRelatedBlogs);
router.get("/:id", authenticate, blogIdValidation, BlogController.getBlogById);
router.post(
  "/:blogId/increment-views",
  blogIdParamValidation,
  BlogController.incrementViews
);

// Comments routes
router.get(
  "/:blogId/comments",
  blogIdParamValidation,
  CommentController.getCommentsByBlog
);
// Comments routes - allow anonymous comments
router.post(
  "/:blogId/comments",
  optionalAuth,
  blogIdParamValidation,
  createCommentValidation,
  CommentController.createComment
);
router.put(
  "/comments/:id",
  authenticate,
  updateCommentValidation,
  CommentController.updateComment
);
router.delete("/comments/:id", authenticate, CommentController.deleteComment);
router.post("/comments/:id/like", authenticate, CommentController.toggleLike);

// Reactions routes
router.post(
  "/:blogId/reactions",
  authenticate,
  blogIdParamValidation,
  createReactionValidation,
  ReactionController.toggleReaction
);
router.get(
  "/:blogId/reactions",
  blogIdParamValidation,
  ReactionController.getBlogReactions
);
router.get(
  "/:blogId/reactions/me",
  authenticate,
  blogIdParamValidation,
  ReactionController.getUserReaction
);

// Admin routes
router.post(
  "/",
  authenticate,
  requireAdmin,
  createBlogValidation,
  BlogController.createBlog
);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  blogIdValidation,
  updateBlogValidation,
  BlogController.updateBlog
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  blogIdValidation,
  BlogController.deleteBlog
);

export default router;
