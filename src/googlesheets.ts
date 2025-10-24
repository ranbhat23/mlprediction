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

    public async getStockClosePrice(stockSymbol: string): Promise<number | null> {
        const symbolCell = 'B1';
        const priceCell = 'F6';
        const sheetName = 'GOOGLEFINANCE';

        // Polling Constraints
        const MAX_WAIT_TIME_MS = 15000; // 15 seconds maximum wait time
        const POLL_INTERVAL_MS = 2000; // Check every 2 seconds

        console.log(`Updating symbol for stock: ${stockSymbol}`);

        // 1. Update the stock symbol cell (B2)
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!${symbolCell}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[stockSymbol]],
                },
            });
            console.log('Stock symbol updated successfully. Starting poll...');

        } catch (error) {
            console.error('Error updating stock symbol, cannot start polling:', error);
            return null;
        }

        // --- 2. Polling Logic Starts Here ---
        const startTime = Date.now();
        let attempts = 0;

        // Loop until max wait time is exceeded
        while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
            attempts++;
            const range = `${sheetName}!${priceCell}`;

            try {
                // Check 1: Wait for the interval (only after the first attempt)
                if (attempts > 1) {
                    const elapsed = Date.now() - startTime;
                    const remainingTime = MAX_WAIT_TIME_MS - elapsed;

                    // Ensure we don't wait longer than the remaining maximum time
                    const waitTime = Math.min(POLL_INTERVAL_MS, remainingTime);

                    if (waitTime <= 0) {
                        throw new PollingError('Max wait time reached before reading data.');
                    }
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

                // Check 2: Read the close price cell (E4)
                const response = await this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: range,
                });

                const rawPriceValue = response.data.values?.[0]?.[0];

                if (rawPriceValue) {
                    const numericPrice = parseFloat(rawPriceValue);

                    // Check 3: Validate the price
                    // We check if it is a valid number AND not a common error string
                    if (!isNaN(numericPrice) && isFinite(numericPrice)) {
                        console.log(`POLL SUCCESS: Price retrieved in ${Date.now() - startTime}ms: ${numericPrice}`);
                        return numericPrice;
                    }
                }

                // If the cell is empty, #N/A, LOADING..., etc.
                console.log(`Attempt ${attempts}: Cell ${range} is still loading or contains invalid data ('${rawPriceValue || 'empty'}').`);

            } catch (error) {
                if (error instanceof PollingError) {
                    console.error(error.message);
                    break; // Exit loop on timeout
                }
                console.error(`Error during polling attempt ${attempts}:`, error);
                // We can continue polling on soft errors, but will break if the max time is exceeded.
            }
        }

        // If the loop finished without returning a price
        console.log(`Polling failed after ${attempts} attempts. Could not retrieve valid price within 15 seconds.`);
        return null;
    }

    /**
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
            console.log(valueRanges);
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
                    .map(v => parseFloat(v))
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
}

class PollingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PollingError';
    }
}
