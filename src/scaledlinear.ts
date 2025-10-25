import * as tf from '@tensorflow/tfjs';

// --- Global Data ---
let _data = [
    { open: 811.35, high: 826.5, low: 811.35, close: 824.45 },
    { open: 791.5, high: 799.85, low: 784, close: 792.4 },
    { open: 791, high: 791.95, low: 782.5, close: 784.95 },
    { open: 774.3, high: 789.45, low: 772.05, close: 786.35 },
    { open: 780, high: 781.95, low: 766, close: 772.8 },
    { open: 765.1, high: 780.85, low: 763.5, close: 780.1 },
    { open: 765, high: 768.7, low: 759.35, close: 764.25 },
    { open: 776.05, high: 781.55, low: 754.45, close: 760.1 },
    { open: 772.25, high: 774.6, low: 767.2, close: 770.2 },
    { open: 774.5, high: 775.75, low: 764.3, close: 773.95 },
    { open: 770.25, high: 780, low: 769.25, close: 774.1 },
    { open: 770, high: 781.5, low: 766.15, close: 768.2 },
    { open: 771, high: 780.75, low: 765.9, close: 767.8 },
    { open: 782.05, high: 784.95, low: 774.35, close: 776.7 },
    { open: 766, high: 790.6, low: 764.1, close: 780.35 },
    { open: 761.9, high: 769.4, low: 755.3, close: 765.95 },
    { open: 759.95, high: 769.7, low: 758.05, close: 761.95 },
    { open: 745, high: 758.8, low: 744.85, close: 753.8 },
    { open: 745.9, high: 749.5, low: 731.95, close: 743.85 },
    { open: 746, high: 769.1, low: 740.05, close: 745.65 }
];

// --- Interfaces ---
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}

// --- Scaling Variables (Determined from _data) ---
// Find min/max across all OHLC values for accurate scaling
const allPrices = _data.flatMap(d => [d.open, d.high, d.low, d.close]);
const MIN_PRICE = Math.min(...allPrices);
const MAX_PRICE = Math.max(...allPrices);
const RANGE = MAX_PRICE - MIN_PRICE;

// --- Scaling Utilities ---
/** Scales a single price value to the range [0, 1] */
function scale(value: number): number {
    return (value - MIN_PRICE) / RANGE;
}

/** Unscales a value from [0, 1] back to the original price range */
function unscale(value: number): number {
    return value * RANGE + MIN_PRICE;
}

// ------------------------------------
// MODEL TRAINING AND PREPARATION
// ------------------------------------

/**
 * Prepares the data, applying Min-Max Scaling to both features and labels.
 */
function prepareLaggedData(data: IntradayData[]) {
    const featureArray: number[][] = [];
    const labelArray: number[] = [];

    // Start from the second data point (index 1) to use yesterday's data
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // 1. Scale Features
        featureArray.push([
            scale(today.open),
            scale(yesterday.high),
            scale(yesterday.low),
            scale(yesterday.close)
        ]);

        // 2. Scale Label (Today's Close)
        labelArray.push(scale(today.close));
    }

    const inputs = tf.tensor2d(featureArray, [featureArray.length, 4]);
    const labels = tf.tensor2d(labelArray, [labelArray.length, 1]);

    return { inputs, labels };
}


async function trainIntradayModel(data: IntradayData[]) {
    // Wrap the data prep and training in tf.tidy to ensure all intermediate tensors are freed
    const model = await tf.tidy(async () => {
        const { inputs, labels } = prepareLaggedData(data);

        const model = tf.sequential();
        // A single dense layer for a simple linear model
        model.add(tf.layers.dense({ units: 1, inputShape: [4] }));

        model.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'meanSquaredError',
        });

        console.log('Starting model training...');
        // Note: Disposing inputs/labels is now handled by the outer tf.tidy()
        await model.fit(inputs, labels, { epochs: 150, verbose: 0 }); 
        console.log('Training complete.');

        return model;
    });

    return model;
}

function predictPrice(
    model: tf.Sequential, 
    currentOpenPrice: number, 
    prevDayHigh: number, 
    prevDayLow: number, 
    prevDayClose: number
): number {

    // Use tf.tidy to ensure all temporary prediction tensors are disposed
    const prediction = tf.tidy(() => {
        // 1. Scale the input data for the model
        const inputDataScaled = [[
            scale(currentOpenPrice), 
            scale(prevDayHigh), 
            scale(prevDayLow), 
            scale(prevDayClose)
        ]];

        const inputTensor = tf.tensor2d(inputDataScaled, [1, 4]); 
        const predictionTensor = model.predict(inputTensor) as tf.Tensor;
        
        // 2. Extract the scaled prediction
        const predictionScaled = predictionTensor.dataSync()[0];

        // 3. Unscale the final value to get the actual price
        return unscale(predictionScaled); 
    });

    return prediction;
}

// ------------------------------------
// EXECUTION LOGIC
// ------------------------------------

export async function runStrategy(data : IntradayData[]) {
    let trainedModel: tf.Sequential | null = null;
    try {
        trainedModel = await trainIntradayModel(data);
        
        // Data for today's prediction (Current Open + Yesterday's OHLC)
        const yesterday = data[data.length - 1]; // Last day in the dataset
        
        const currentOpenPrice = 811.25; 
        const prevDayHigh = yesterday.high; 
        const prevDayLow = yesterday.low; 
        const prevDayClose = yesterday.close;
        
        const predictedClose = predictPrice(
            trainedModel, 
            currentOpenPrice, 
            prevDayHigh, 
            prevDayLow, 
            prevDayClose
        );

        console.log(`\n--- Scaling Parameters ---`);
        console.log(`Min Price: ${MIN_PRICE.toFixed(2)}, Max Price: ${MAX_PRICE.toFixed(2)}`);

        console.log(`\n--- Model Inputs ---`);
        console.log(`Inputs: Open=${currentOpenPrice.toFixed(2)}, Prev H/L/C=${prevDayHigh.toFixed(2)}/${prevDayLow.toFixed(2)}/${prevDayClose.toFixed(2)}`);

        console.log(`\n--- Strategy Output ---`);
        console.log(`Current Open Price: $${currentOpenPrice.toFixed(2)}`);
        console.log(`Predicted Close Price: $${predictedClose.toFixed(2)}`);

        const actualClose = 823; // Actual price for a specific date (used for comparison)
        const deviation = predictedClose - actualClose;
        console.log(`\n--- Performance Check ---`);
        console.log(`Actual Close: $${actualClose.toFixed(2)}`);
        console.log(`Deviation: $${deviation.toFixed(2)}`);

    } catch (error) {
        console.error("An error occurred during the ML process:", error);
    } finally {
        // Ensure the trained model is disposed after all use
        if (trainedModel) {
            trainedModel.dispose();
            console.log('\nTrained model and all tensors disposed.');
        }
    }
}

runStrategy(_data);
