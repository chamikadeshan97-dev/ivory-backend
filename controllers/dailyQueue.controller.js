import {
  addWalkInToQueueService,
  checkInAppointmentService,
  deleteQueueItemService,
  getCurrentQueuePatientService,
  getNextQueuePatientService,
  getPreviousQueuePatientService,
  getQueueByDateService,
  getQueueItemByIdService,
  updateQueueStatusService,
} from "../services/dailyQueue.service.js";

export const getDailyQueue = (req, res) => {
  try {
    const { date } = req.query;

    const queue = getQueueByDateService(date);

    res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getQueueItemById = (req, res) => {
  try {
    const { id } = req.params;

    const queueItem = getQueueItemByIdService(id);

    res.status(200).json({
      success: true,
      data: queueItem,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const checkInAppointment = (req, res) => {
  try {
    const queueItem = checkInAppointmentService(req.body);

    res.status(201).json({
      success: true,
      message: "Patient checked in and added to queue successfully",
      data: queueItem,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const addWalkInToQueue = (req, res) => {
  try {
    const queueItem = addWalkInToQueueService(req.body);

    res.status(201).json({
      success: true,
      message: "Walk-in patient added to queue successfully",
      data: queueItem,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateQueueStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedQueueItem = updateQueueStatusService({
      id,
      status,
    });

    res.status(200).json({
      success: true,
      message: "Queue status updated successfully",
      data: updatedQueueItem,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getNextQueuePatient = (req, res) => {
  try {
    const { date } = req.query;

    const patient = getNextQueuePatientService(date);

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCurrentQueuePatient = (req, res) => {
  try {
    const { date } = req.query;

    const patient = getCurrentQueuePatientService(date);

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPreviousQueuePatient = (req, res) => {
  try {
    const { date } = req.query;

    const patient = getPreviousQueuePatientService(date);

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteQueueItem = (req, res) => {
  try {
    const { id } = req.params;

    deleteQueueItemService(id);

    res.status(200).json({
      success: true,
      message: "Queue item removed successfully",
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};