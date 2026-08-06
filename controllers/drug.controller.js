import * as drugService from "../services/drug.service.js";

import sendError from "../utils/sendError.js";

/*
|--------------------------------------------------------------------------
| Create Drug
|--------------------------------------------------------------------------
|
| POST /api/drugs
|
*/

async function createDrug(req, res) {
  try {
    const drug = await drugService.createDrug(
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Drug created successfully",
      data: drug,
    });
  } catch (error) {
    sendError(res, error, "Failed to create drug");
  }
}

/*
|--------------------------------------------------------------------------
| Create Multiple Drugs
|--------------------------------------------------------------------------
|
| POST /api/drugs/bulk
|
*/

async function createDrugsBulk(req, res) {
  try {
    const result =
      await drugService.createDrugsBulk(
        req.body,
      );

    res.status(201).json({
      success: true,
      message: "Drugs created successfully",
      data: result,
    });
  } catch (error) {
    sendError(res, error, "Failed to create drugs");
  }
}

/*
|--------------------------------------------------------------------------
| Get All Drugs
|--------------------------------------------------------------------------
|
| GET /api/drugs
|
*/

async function getDrugs(req, res) {
  try {
    const drugs = await drugService.getDrugs(
      req.query,
    );

    res.json({
      success: true,
      count: drugs.length,
      data: drugs,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch drugs");
  }
}

/*
|--------------------------------------------------------------------------
| Search Drugs
|--------------------------------------------------------------------------
|
| GET /api/drugs/search?query=amoxicillin
|
*/

async function searchDrugs(req, res) {
  try {
    const drugs = await drugService.searchDrugs(
      req.query.query,
    );

    res.json({
      success: true,
      count: drugs.length,
      data: drugs,
    });
  } catch (error) {
    sendError(res, error, "Failed to search drugs");
  }
}

/*
|--------------------------------------------------------------------------
| Get Drug by ID
|--------------------------------------------------------------------------
|
| GET /api/drugs/:id
|
*/

async function getDrugById(req, res) {
  try {
    const drug = await drugService.getDrugById(
      req.params.id,
    );

    res.json({
      success: true,
      data: drug,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch drug");
  }
}

/*
|--------------------------------------------------------------------------
| Update Drug
|--------------------------------------------------------------------------
|
| PUT /api/drugs/:id
| PATCH /api/drugs/:id
|
*/

async function updateDrug(req, res) {
  try {
    const drug = await drugService.updateDrug(
      req.params.id,
      req.body,
    );

    res.json({
      success: true,
      message: "Drug updated successfully",
      data: drug,
    });
  } catch (error) {
    sendError(res, error, "Failed to update drug");
  }
}

/*
|--------------------------------------------------------------------------
| Delete Drug
|--------------------------------------------------------------------------
|
| DELETE /api/drugs/:id
|
*/

async function deleteDrug(req, res) {
  try {
    const drug = await drugService.deleteDrug(
      req.params.id,
    );

    res.json({
      success: true,
      message: "Drug deleted successfully",
      data: drug,
    });
  } catch (error) {
    sendError(res, error, "Failed to delete drug");
  }
}

export {
  createDrug,
  createDrugsBulk,
  getDrugs,
  searchDrugs,
  getDrugById,
  updateDrug,
  deleteDrug,
};