
import {
  getAllIdleSlides,
  getEnabledIdleSlides,
  createIdleSlide,
  updateIdleSlide,
  replaceIdleSlideImage,
  deleteIdleSlide,
} from "../services/idleDisplayService.js";

/* =========================================================
   ASYNC HANDLER
========================================================= */

const handle = (operation) => async (req, res, next) => {
  try {
    await operation(req, res);
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   GET ENABLED POSTERS
========================================================= */

export const getDisplaySlides = handle(
  async (req, res) => {
    const slides = await getEnabledIdleSlides();

    res.set("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      count: slides.length,
      data: slides,
    });
  },
);

/* =========================================================
   GET ALL POSTERS
========================================================= */

export const getAdminSlides = handle(
  async (req, res) => {
    const slides = await getAllIdleSlides();

    res.status(200).json({
      success: true,
      count: slides.length,
      data: slides,
    });
  },
);

/* =========================================================
   CREATE POSTER
========================================================= */

export const addDisplaySlide = handle(
  async (req, res) => {
    console.log("addDisplaySlide controller");
    const slide = await createIdleSlide(
      req.body,
      req.file,
    );

    res.status(201).json({
      success: true,
      message: "Poster created successfully",
      data: slide,
    });
  },
);

/* =========================================================
   UPDATE POSTER
========================================================= */

export const editDisplaySlide = handle(
  async (req, res) => {
    const slide = await updateIdleSlide(
      req.params.slideId,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Poster updated successfully",
      data: slide,
    });
  },
);

/* =========================================================
   REPLACE IMAGE
========================================================= */

export const changeDisplaySlideImage = handle(
  async (req, res) => {
    const slide = await replaceIdleSlideImage(
      req.params.slideId,
      req.file,
    );

    res.status(200).json({
      success: true,
      message: "Poster image replaced successfully",
      data: slide,
    });
  },
);

/* =========================================================
   DELETE POSTER
========================================================= */

export const removeDisplaySlide = handle(
  async (req, res) => {
    const result = await deleteIdleSlide(
      req.params.slideId,
    );

    res.status(200).json({
      success: true,
      message: "Poster deleted successfully",
      data: result,
    });
  },
);
