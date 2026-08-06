import fs from "fs";
import path from "path";

import { EXCEL_FILE_PATH } from "../utils/excelDb.js";

export const downloadCurrentExcelFile = async (req, res) => {
  try {
    const resolvedFilePath = path.resolve(EXCEL_FILE_PATH);

    console.log("Excel file download path:", resolvedFilePath);

    if (!fs.existsSync(resolvedFilePath)) {
      return res.status(404).json({
        success: false,
        message: "Excel database file was not found",
        filePath: resolvedFilePath,
      });
    }

    const currentDate = new Date()
      .toISOString()
      .split("T")[0];

    const downloadFileName =
      `dental-clinic-backup-${currentDate}.xlsx`;

    return res.download(
      resolvedFilePath,
      downloadFileName,
      (error) => {
        if (error) {
          console.error("Excel download error:", error);

          if (!res.headersSent) {
            return res.status(500).json({
              success: false,
              message: "Failed to download Excel database",
            });
          }
        }
      },
    );
  } catch (error) {
    console.error("Download Excel error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to download Excel database",
      error: error.message,
    });
  }
};