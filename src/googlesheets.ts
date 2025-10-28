import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
// Note: The 'with { type: 'json' }' syntax is a modern feature. 
// If your environment doesn't support it, you may need to use require() or adjust your tsconfig.
import credentials from '../gsheetskey.json' with { type: 'json' };
import { Config } from './config.js';

/**
 * Manages all interactions with a Google Sheet, including authorization, reading, and updating data.
 * This class is implemented as a **Singleton** to ensure only one authorized
 * Google Sheets API client exists throughout the application.
 */
export class GoogleSheetManager {
    // 1. Static property to hold the single instance
    private static instance: GoogleSheetManager;

    private sheets: sheets_v4.Sheets;
    private spreadsheetId: string;

    /**
     * 2. The constructor is private to prevent direct construction calls with 'new'.
     * The initialization logic (like authorization) is moved here.
     */
    private constructor(spreadsheetId: string) {
        this.spreadsheetId = spreadsheetId;
        this.sheets = this.authorize();
    }

    /**
     * 3. The static method that controls access to the singleton instance.
     * It creates the instance upon the first call.
     * @param {string} spreadsheetId The ID of the Google Sheet.
     * @returns {GoogleSheetManager} The single instance of the GoogleSheetManager.
     */
    public static getInstance(spreadsheetId: string): GoogleSheetManager {
        if (!GoogleSheetManager.instance) {
            GoogleSheetManager.instance = new GoogleSheetManager(spreadsheetId);
        }
        return GoogleSheetManager.instance;
    }

    /**
     * Authorizes the client using a JWT service account.
     * @returns {sheets_v4.Sheets} The authorized Google Sheets API client.
     */
    private authorize(): sheets_v4.Sheets {
        const jwtClient = new JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return google.sheets({ version: 'v4', auth: jwtClient });
    }

    // -------------------------------------------------------------------------
    // REMAINDER OF THE CLASS METHODS (UNCHANGED FUNCTIONALITY)
    // -------------------------------------------------------------------------

    /**
     * Reads data from a specified range.
     * @param {string} range The range to read from.
     * @returns {Promise<any[][] | null>} The data from the sheet or null on error.
     */
    public async readData(range: string): Promise<any[][] | null> {
        // ... (existing implementation)
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });
            console.log('Read successful.');
            return response.data.values || null;
        } catch (error) {
            console.error('Error reading data:', error);
            return null;
        }
    }

    /**
     * Updates data in a specified range.
     * @param {string} range The range to update.
     * @param {any[][]} values The values to write to the sheet.
     */
    public async updateData(range: string, values: any[][]): Promise<void> {
        // ... (existing implementation)
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values },
            });
            console.log('Update successful.');
        } catch (error) {
            console.error('Error updating data:', error);
        }
    }

    /**
     * Clears data from a specified range.
     * @param {string} range The range to clear.
     */
    public async clearData(range: string): Promise<void> {
        // ... (existing implementation)
        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });
            console.log('Clear successful.');
        } catch (error) {
            console.error('Error clearing data:', error);
        }
    }

    public async getCellValue(stockSymbol: string, _closePrice?: string, _openPrice?: string, _ppPrice?: string
, _highPrice?: string, _lowPrice?: string    ): Promise<{ open: number, close: number, pp: number, high: number, low: number } | null> {
        // --- Configuration ---
        const symbolCell = 'B1';
        // Use an array to manage all required cell ranges efficiently
        const cellRanges = [
            { name: 'open', cell: _openPrice ?? 'C6' },
            { name: 'close', cell: _closePrice ?? 'F6' },
            { name: 'pp', cell: _ppPrice ?? 'L6' },
            { name: 'high', cell: _highPrice ?? 'D6' },
            { name: 'low', cell: _lowPrice ?? 'E6' },
        ];
        const sheetName = 'GOOGLEFINANCE';
        const MAX_WAIT_TIME_MS = 15000;
        const POLL_INTERVAL_MS = 2000;
        const rangeSpecs = cellRanges.map(c => `${sheetName}!${c.cell}`);

        console.log(`Updating symbol for stock: ${stockSymbol}`);

        // 1. Update the stock symbol cell (B1)
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!${symbolCell}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[stockSymbol]],
                },
            });
            console.log('\x1b[32m%s\x1b[0m', '✅ Stock symbol updated successfully. Starting poll...');
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', 'Error updating stock symbol, cannot start polling:', error);
            return null;
        }

        // --- 2. Polling Logic Starts Here ---
        const startTime = Date.now();
        let attempts = 0;

        while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
            attempts++;

            // Check 1: Wait for the interval (only after the first attempt)
            if (attempts > 1) {
                const elapsed = Date.now() - startTime;
                const remainingTime = MAX_WAIT_TIME_MS - elapsed;
                const waitTime = Math.min(POLL_INTERVAL_MS, remainingTime);

                if (waitTime <= 0) {
                    // Throw an error to cleanly exit the loop on timeout
                    throw new PollingError('Max wait time reached before reading data.');
                }
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            try {
                // Check 2: Read all three cells in a single batch request
                const response = await this.sheets.spreadsheets.values.batchGet({
                    spreadsheetId: this.spreadsheetId,
                    ranges: rangeSpecs, // Array of ranges: ['Sheet!C6', 'Sheet!F6', 'Sheet!L6']
                });

                const values = response.data.valueRanges;
                let currentValues: { [key: string]: number } = {};
                let allValid = true;

                // Check 3: Process and validate all three values
                for (let i = 0; i < cellRanges.length; i++) {
                    const name = cellRanges[i].name;
                    const cell = cellRanges[i].cell;
                    // The value is in the 'values' array inside the 'valueRanges' array at index i
                    const rawValue = values?.[i]?.values?.[0]?.[0];

                    if (rawValue) {
                        const numericValue = parseFloat(rawValue.replace(/,/g, '')); // Safely handle comma separators

                        if (!isNaN(numericValue) && isFinite(numericValue)) {
                            currentValues[name] = numericValue;
                            continue; // This value is valid
                        }
                    }

                    // If we reach here, the value is missing or invalid
                    console.log(`\x1b[33m%s\x1b[0m`, `Attempt ${attempts} (${(Date.now() - startTime) / 1000}s): Cell ${cell} (${name}) is still loading or contains invalid data ('${rawValue || 'empty'}').`);
                    allValid = false;
                    break; // Break the inner loop and continue polling if any value is invalid
                }

                // Check 4: If all three values are valid, return the result
                if (allValid && Object.keys(currentValues).length === 3) {
                    console.log('\x1b[36m%s\x1b[0m', `\n✅ Polling success in ${attempts} attempts!`);
                    return {
                        open: currentValues.open,
                        close: currentValues.close,
                        pp: currentValues.pp,
                        high: currentValues.high,
                        low: currentValues.low
                    };
                }

            } catch (error) {
                if (error instanceof PollingError) {
                    console.error('\x1b[31m%s\x1b[0m', error.message);
                    break; // Exit loop on timeout
                }
                console.error('\x1b[31m%s\x1b[0m', `Error during polling attempt ${attempts}:`, error);
            }
        }

        // If the loop finished without returning a price
        console.log('\x1b[31m%s\x1b[0m', `\n❌ Polling failed after ${attempts} attempts. Could not retrieve valid data within 15 seconds.`);
        return null;
    }
    /*
     * Grabs OHLC data from the specified ranges in the Google Sheet 
     * and formats it into four parallel arrays suitable for TA-Lib.
     * * @returns A promise that resolves to an object containing the four OHLC arrays.
     */
    public async getOhlcArrays(sheetName: string = 'GOOGLEFINANCE'): Promise<{ open: number[], high: number[], low: number[], close: number[] }> {
        // Define the ranges for the OHLC columns.
        // We assume the data starts on row 4 and ends on row 54 (51 data points).
        const ranges = [
            `${sheetName}!C8:C27`, // Open
            `${sheetName}!D8:D27`, // High
            `${sheetName}!E8:E27`, // Low
            `${sheetName}!F8:F27`, // Close
        ];

        try {
            const response = await this.sheets.spreadsheets.values.batchGet({
                spreadsheetId: this.spreadsheetId,
                ranges: ranges,
            });

            const valueRanges = response.data.valueRanges;
            if (!valueRanges || valueRanges.length !== 4) {
                throw new Error("Could not retrieve all five OHLC data ranges.");
            }
            // Helper function to extract and convert array data
            const processArray = (rangeIndex: number): number[] => {
                const values = valueRanges[rangeIndex]?.values;

                // Flatten the 2D array (e.g., [['10.5'], ['11.0'], ...]) and convert to numbers.
                // .flat() flattens the array by one level.
                // parseFloat is used for safety in case Google Sheets stores it as a string.
                return (values || [])
                    .flat()
                    .map(String) // Ensure each item is a string before parsing
                    .map(v => {
                        const cleanedString = v.replace(/,/g, '');
                        // 2. Convert to number
                        return parseFloat(cleanedString);
                    })
                    // Filter out any invalid numbers (e.g., blank cells or non-numeric data)
                    .filter(v => !isNaN(v));
            };
            const openArray = processArray(0);
            const highArray = processArray(1);
            const lowArray = processArray(2);
            const closeArray = processArray(3);

            // A final check to ensure all arrays have the same length
            const length = openArray.length;
            if (length === 0) {
                throw new Error("Retrieved arrays are empty. Check sheet name and ranges.");
            }
            if (highArray.length !== length || lowArray.length !== length || closeArray.length !== length) {
                console.warn("OHLC arrays have inconsistent lengths. Some data might be missing/non-numeric.");
            }

            return {
                open: openArray,
                high: highArray,
                low: lowArray,
                close: closeArray,
            };

        } catch (error) {
            console.error("The API returned an error during OHLC data retrieval: ", error);
            throw new Error("Failed to get OHLC data from Google Sheet.");
        }
    }
    /**
 * Grabs OHLC data from the specified ranges in the Google Sheet 
 * and formats it into four parallel arrays suitable for TA-Lib.
 * * @returns A promise that resolves to an object containing the four OHLC arrays.
 */
    public async getOhlcvArrays(sheetName: string = 'GOOGLEFINANCE'): Promise<{ open: number[], high: number[], low: number[], close: number[], volume: number[] }> {
        // Define the ranges for the OHLC columns.
        // We assume the data starts on row 4 and ends on row 54 (51 data points).
        const ranges = [
            `${sheetName}!C8:C27`, // Open
            `${sheetName}!D8:D27`, // High
            `${sheetName}!E8:E27`, // Low
            `${sheetName}!F8:F27`, // Close
            `${sheetName}!G8:G27`, // volume
        ];

        try {
            const response = await this.sheets.spreadsheets.values.batchGet({
                spreadsheetId: this.spreadsheetId,
                ranges: ranges,
            });

            const valueRanges = response.data.valueRanges;
            if (!valueRanges || valueRanges.length !== 5) {
                throw new Error("Could not retrieve all five OHLC data ranges.");
            }
            // Helper function to extract and convert array data
            const processArray = (rangeIndex: number): number[] => {
                const values = valueRanges[rangeIndex]?.values;

                // Flatten the 2D array (e.g., [['10.5'], ['11.0'], ...]) and convert to numbers.
                // .flat() flattens the array by one level.
                // parseFloat is used for safety in case Google Sheets stores it as a string.
                return (values || [])
                    .flat()
                    .map(String) // Ensure each item is a string before parsing
                    .map(v => {
                        const cleanedString = v.replace(/,/g, '');
                        // 2. Convert to number
                        return parseFloat(cleanedString);
                    })
                    // Filter out any invalid numbers (e.g., blank cells or non-numeric data)
                    .filter(v => !isNaN(v));
            };
            const openArray = processArray(0);
            const highArray = processArray(1);
            const lowArray = processArray(2);
            const closeArray = processArray(3);
            const volumeArray = processArray(4);

            const length = openArray.length;
            if (length === 0) {
                throw new Error("Retrieved arrays are empty. Check sheet name and ranges.");
            }
            if (highArray.length !== length || lowArray.length !== length || closeArray.length !== length || volumeArray.length !== length) {
                console.warn("OHLC arrays have inconsistent lengths. Some data might be missing/non-numeric.");
            }

            return {
                open: openArray,
                high: highArray,
                low: lowArray,
                close: closeArray,
                volume: volumeArray,
            };

        } catch (error) {
            console.error("The API returned an error during OHLC data retrieval: ", error);
            throw new Error("Failed to get OHLC data from Google Sheet.");
        }
    }
    /**
* Grabs OHLC data from the specified ranges in the Google Sheet 
* and formats it into four parallel arrays suitable for TA-Lib.
* * @returns A promise that resolves to an object containing the four OHLC arrays.
*/
    public async getOhlcppArrays(sheetName: string = 'GOOGLEFINANCE'): Promise<{ open: number[], high: number[], low: number[], close: number[], pp: number[] }> {
        // Define the ranges for the OHLC columns.
        // We assume the data starts on row 4 and ends on row 54 (51 data points).
        const ranges = [
            `${sheetName}!C8:C67`, // Open
            `${sheetName}!D8:D67`, // High
            `${sheetName}!E8:E67`, // Low
            `${sheetName}!F8:F67`, // Close
            `${sheetName}!L8:L67`, // PP
        ];

        try {
            const response = await this.sheets.spreadsheets.values.batchGet({
                spreadsheetId: this.spreadsheetId,
                ranges: ranges,
            });

            const valueRanges = response.data.valueRanges;
            if (!valueRanges || valueRanges.length !== 5) {
                throw new Error("Could not retrieve all five OHLC data ranges.");
            }
            // Helper function to extract and convert array data
            const processArray = (rangeIndex: number): number[] => {
                const values = valueRanges[rangeIndex]?.values;

                // Flatten the 2D array (e.g., [['10.5'], ['11.0'], ...]) and convert to numbers.
                // .flat() flattens the array by one level.
                // parseFloat is used for safety in case Google Sheets stores it as a string.
                return (values || [])
                    .flat()
                    .map(String) // Ensure each item is a string before parsing
                    .map(v => {
                        const cleanedString = v.replace(/,/g, '');
                        // 2. Convert to number
                        return parseFloat(cleanedString);
                    })
                    // Filter out any invalid numbers (e.g., blank cells or non-numeric data)
                    .filter(v => !isNaN(v));
            };
            const openArray = processArray(0);
            const highArray = processArray(1);
            const lowArray = processArray(2);
            const closeArray = processArray(3);
            const ppArray = processArray(4);

            const length = openArray.length;
            if (length === 0) {
                throw new Error("Retrieved arrays are empty. Check sheet name and ranges.");
            }
            if (highArray.length !== length || lowArray.length !== length || closeArray.length !== length || ppArray.length !== length) {
                console.warn("OHLC arrays have inconsistent lengths. Some data might be missing/non-numeric.");
            }

            return {
                open: openArray,
                high: highArray,
                low: lowArray,
                close: closeArray,
                pp: ppArray,
            };

        } catch (error) {
            console.error("The API returned an error during OHLC data retrieval: ", error);
            throw new Error("Failed to get OHLC data from Google Sheet.");
        }
    }
}

class PollingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PollingError';
    }
}
