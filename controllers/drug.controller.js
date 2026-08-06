import * as drugService from "../services/drug.service.js";

import sendError from "../utils/sendError.js";

/*
|--------------------------------------------------------------------------
| Create Drug
|--------------------------------------------------------------------------
|
| POST /api/drugs
|
| Body:
| {
|   "name": "Amoxicillin 500mg"
| }
|
*/

function createDrug(req, res) {
  try {
    const drug = drugService.createDrug(req.body);

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
| Body:
| {
|   "drugs": [
|     {
|       "name": "Amoxicillin 500mg"
|     },
|     {
|       "name": "Paracetamol 500mg"
|     }
|   ]
| }
|
*/

function createDrugsBulk(req, res) {
  try {
    const result = drugService.createDrugsBulk(req.body);

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
| Optional:
| GET /api/drugs?search=amoxicillin
| GET /api/drugs?sort=asc
| GET /api/drugs?sort=desc
|
*/

function getDrugs(req, res) {
  try {
    const drugs = drugService.getDrugs(req.query);

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

function searchDrugs(req, res) {
  try {
    const drugs = drugService.searchDrugs(req.query.query);

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

function getDrugById(req, res) {
  try {
    const drug = drugService.getDrugById(req.params.id);

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
| Body:
| {
|   "name": "Amoxicillin 250mg"
| }
|
*/

function updateDrug(req, res) {
  try {
    const drug = drugService.updateDrug(
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

function deleteDrug(req, res) {
  try {
    const drug = drugService.deleteDrug(req.params.id);

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