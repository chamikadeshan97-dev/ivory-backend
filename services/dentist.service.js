import { readSheet, writeSheet } from "../utils/excelDb.js";
import { createId, now } from "../utils/helpers.js";
import appError from "../utils/appError.js";

export function createDentist(data) {
  const { name, phone, specialization } = data;

  if (!name) {
    throw appError("Dentist name is required", 400);
  }

  const dentists = readSheet("Dentists");

  const newDentist = {
    id: createId("DEN"),
    name,
    phone: phone || "",
    specialization: specialization || "",
    created_at: now(),
    updated_at: now(),
  };

  dentists.push(newDentist);
  writeSheet("Dentists", dentists);

  return newDentist;
}

export function getAllDentists() {
  return readSheet("Dentists");
}

export function searchDentists(q) {
  const dentists = readSheet("Dentists");

  if (!q) {
    return dentists;
  }

  const keyword = q.toLowerCase();

  return dentists.filter((dentist) => {
    return (
      String(dentist.name).toLowerCase().includes(keyword) ||
      String(dentist.phone).toLowerCase().includes(keyword) ||
      String(dentist.specialization).toLowerCase().includes(keyword)
    );
  });
}

export function getDentistById(id) {
  const dentists = readSheet("Dentists");

  const dentist = dentists.find((d) => d.id === id);

  if (!dentist) {
    throw appError("Dentist not found", 404);
  }

  return dentist;
}

export function updateDentist(id, data) {
  const dentists = readSheet("Dentists");

  const index = dentists.findIndex((d) => d.id === id);

  if (index === -1) {
    throw appError("Dentist not found", 404);
  }

  const existing = dentists[index];

  dentists[index] = {
    ...existing,
    name: data.name ?? existing.name,
    phone: data.phone ?? existing.phone,
    specialization: data.specialization ?? existing.specialization,
    updated_at: now(),
  };

  writeSheet("Dentists", dentists);

  return dentists[index];
}

export function deleteDentist(id) {
  const dentists = readSheet("Dentists");

  const index = dentists.findIndex((d) => d.id === id);

  if (index === -1) {
    throw appError("Dentist not found", 404);
  }

  const deletedDentist = dentists[index];

  dentists.splice(index, 1);
  writeSheet("Dentists", dentists);

  return deletedDentist;
}

export function getDentistStatistics() {
  const dentists = readSheet("Dentists");

  const totalDentists = dentists.length;

  const specializationCounts = {};

  dentists.forEach((dentist) => {
    const specialization = dentist.specialization || "General";
    specializationCounts[specialization] =
      (specializationCounts[specialization] || 0) + 1;
  });

  return {
    total_dentists: totalDentists,
    specialization_breakdown: specializationCounts,
  };
}