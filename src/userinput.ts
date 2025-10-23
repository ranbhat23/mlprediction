import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Prompts the user for input in the terminal and returns the entered string.
 * @param query The question to display to the user.
 * @returns A Promise that resolves with the user's input string.
 */
function getUserInput(query: string): Promise<string> {
    // 1. Create a readline interface
    const rl = readline.createInterface({ input, output });

    // 2. Wrap the prompt logic in a Promise
    return new Promise(resolve => {
        rl.question(query, (answer) => {
            // 3. Close the interface after getting the answer
            rl.close();
            // 4. Resolve the Promise with the answer
            resolve(answer);
        });
    });
}

// --- Example Usage ---
async function main() {
    console.log("Welcome to the Trading Model Predictor!");

    // Wait for the user to input the data
    const openPriceString = await getUserInput("Please enter today's Open Price (e.g., 900.90): ");
    
    // Convert the input string to a number
    const openPrice = parseFloat(openPriceString);

    if (isNaN(openPrice)) {
        console.log("Invalid input. Exiting.");
        return;
    }

    console.log(`\nThank you. Running prediction for Open Price: $${openPrice.toFixed(2)}`);
    
    // You would insert your model prediction logic here using 'openPrice'
    // ...

    console.log("Prediction complete.");
}

// main(); // Uncomment to run this example in Node.js
